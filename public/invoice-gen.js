/* invoice2gst — Free GST Invoice Generator engine (static, no login).
   Mounts into #ig-app, reads data-preset, builds form + live A4 preview,
   computes GST (CGST/SGST | IGST | LUT-zero | RCM) and exports a vector PDF. */
(function () {
  "use strict";
  var jspdfReady = function () { return window.jspdf && window.jspdf.jsPDF; };

  // ---- reference data ----
  var STATES = [["01","Jammu & Kashmir"],["02","Himachal Pradesh"],["03","Punjab"],["04","Chandigarh"],["05","Uttarakhand"],["06","Haryana"],["07","Delhi"],["08","Rajasthan"],["09","Uttar Pradesh"],["10","Bihar"],["11","Sikkim"],["12","Arunachal Pradesh"],["13","Nagaland"],["14","Manipur"],["15","Mizoram"],["16","Tripura"],["17","Meghalaya"],["18","Assam"],["19","West Bengal"],["20","Jharkhand"],["21","Odisha"],["22","Chhattisgarh"],["23","Madhya Pradesh"],["24","Gujarat"],["26","Dadra & Nagar Haveli and Daman & Diu"],["27","Maharashtra"],["29","Karnataka"],["30","Goa"],["31","Lakshadweep"],["32","Kerala"],["33","Tamil Nadu"],["34","Puducherry"],["35","Andaman & Nicobar Islands"],["36","Telangana"],["37","Andhra Pradesh"],["38","Ladakh"],["97","Other Territory"]];
  var UNITS = ["Nos","Pcs","Kgs","Hours","Ltr","Mtr","Sqft","Set","Box","Unit","Day","Month"];
  var RATES = [0,5,12,18,28];
  var CUR = { INR:{sym:"\u20B9",code:"INR",word:"Rupees",sub:"Paise"}, USD:{sym:"$",code:"USD",word:"US Dollars",sub:"Cents"} };

  // ---- SEO presets ----
  var PRESETS = {
    "generic": { h1:"Free GST Invoice Generator", unit:"Nos", rate:18 },
    "export-invoice-lut": { h1:"Export Invoice Generator (LUT / Bond)", currency:"USD", lut:true, rate:0, unit:"Nos",
      note:"Supply meant for export under LUT/Bond without payment of IGST (Rule 96A of CGST Rules)." },
    "freelance-it-consultant": { h1:"Invoice Generator for Freelancers & IT Consultants", sac:"9983", rate:18, unit:"Hours",
      item:"Software / consulting services" },
    "manpower-staffing-agency": { h1:"Invoice Generator for Manpower & Staffing Agencies", sac:"9985", rate:18, unit:"Nos",
      items:[{desc:"Wages / reimbursement of staff cost",sac:"9985",rate:18},{desc:"Service charges / agency fee",sac:"9985",rate:18}] },
    "transporter-gta": { h1:"GTA / Transporter Invoice Generator", sac:"9965", rcm:true, rate:0, unit:"Nos",
      item:"Goods transport service (GTA)", note:"GST payable by recipient under Reverse Charge (RCM), Sec 9(3) / Notification 13/2017-CT(R)." },
    "b2b-tax-invoice": { h1:"B2B GST Tax Invoice Generator", rate:18, unit:"Nos", eway:true }
  };

  // ---- helpers ----
  function num(x){ var n=parseFloat(x); return isNaN(n)?0:n; }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function fmt(n,cur){ cur=cur||"INR"; return CUR[cur].sym+(Number(n)||0).toLocaleString(cur==="INR"?"en-IN":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }

  var ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  var tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function two(x){ return x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?" "+ones[x%10]:""); }
  function three(x){ var h=Math.floor(x/100), r=x%100; return (h?ones[h]+" Hundred"+(r?" ":""):"")+(r?two(r):""); }
  function wordsIndian(n){ n=Math.round(Math.abs(n)); if(n===0)return "Zero"; var out="",cr=Math.floor(n/1e7);n%=1e7;var la=Math.floor(n/1e5);n%=1e5;var th=Math.floor(n/1e3);n%=1e3; if(cr)out+=two(cr)+" Crore ";if(la)out+=two(la)+" Lakh ";if(th)out+=two(th)+" Thousand ";if(n)out+=three(n); return out.trim(); }
  function wordsIntl(n){ n=Math.round(Math.abs(n)); if(n===0)return "Zero"; var g=[["Billion",1e9],["Million",1e6],["Thousand",1e3]],out=""; g.forEach(function(x){ var v=Math.floor(n/x[1]); if(v){out+=three(v)+" "+x[0]+" "; n%=x[1];} }); if(n)out+=three(n); return out.trim(); }
  function moneyWords(amt,cur){ cur=cur||"INR"; var w=cur==="INR"?wordsIndian:wordsIntl; var r=Math.floor(amt),p=Math.round((amt-r)*100); var s=CUR[cur].code+" "+w(r)+" "+CUR[cur].word; if(p)s+=" and "+w(p)+" "+CUR[cur].sub; return s+" Only"; }

  function fillSel(sel,opts,val){ sel.innerHTML=""; opts.forEach(function(o){ var v=o,t=o; if(Array.isArray(o)){v=o[0];t=o[0]+" - "+o[1];} var e=document.createElement("option"); e.value=v; e.textContent=t; sel.appendChild(e); }); if(val!=null) sel.value=val; }
  function stateName(c){ for(var i=0;i<STATES.length;i++) if(STATES[i][0]===c) return STATES[i][1]; return ""; }

  // ---- UI template ----
  function tpl(){
    return ''+
    '<div class="ig-cols">'+
      '<div class="ig-form">'+
        '<div class="ig-card"><h3>Your business (Supplier)</h3>'+
          '<div class="ig-row"><label>Business name *</label><input id="s_name"></div>'+
          '<div class="ig-g2"><div class="ig-row"><label>GSTIN</label><input id="s_gstin" maxlength="15" class="up"></div><div class="ig-row"><label>PAN</label><input id="s_pan" maxlength="10" class="up"></div></div>'+
          '<div class="ig-row"><label>Address</label><textarea id="s_addr" rows="2"></textarea></div>'+
          '<div class="ig-g2"><div class="ig-row"><label>State</label><select id="s_state"></select></div><div class="ig-row"><label>Logo</label><input id="s_logo" type="file" accept="image/*"></div></div>'+
          '<div class="ig-g2"><div class="ig-row"><label>Email</label><input id="s_email"></div><div class="ig-row"><label>Phone</label><input id="s_phone"></div></div>'+
          '<button class="ig-btn ghost sm" id="saveBiz">Save my business</button> <span class="ig-ok" id="bizOk"></span>'+
        '</div>'+
        '<div class="ig-card"><h3>Bill to (Customer)</h3>'+
          '<div class="ig-row"><label>Customer name *</label><input id="c_name"></div>'+
          '<div class="ig-g2"><div class="ig-row"><label>Customer GSTIN</label><input id="c_gstin" maxlength="15" class="up"></div><div class="ig-row"><label>Place of supply *</label><select id="c_pos"></select></div></div>'+
          '<div class="ig-row"><label>Billing address</label><textarea id="c_addr" rows="2"></textarea></div>'+
          '<div class="ig-row"><label class="ig-inline"><input type="checkbox" id="c_ship_diff"> Ship to a different address</label></div>'+
          '<div class="ig-row" id="c_ship_wrap" style="display:none"><label>Shipping address</label><textarea id="c_ship" rows="2"></textarea></div>'+
        '</div>'+
        '<div class="ig-card"><h3>Invoice details</h3>'+
          '<div class="ig-g2"><div class="ig-row"><label>Invoice no.</label><input id="i_num"></div><div class="ig-row"><label>Invoice date</label><input id="i_date" type="date"></div></div>'+
          '<div class="ig-g2"><div class="ig-row"><label>Due date</label><input id="i_due" type="date"></div><div class="ig-row"><label>Payment terms</label><input id="i_terms" placeholder="e.g. Net 15"></div></div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label class="ig-inline"><input type="checkbox" id="i_rcm"> Reverse charge (RCM)</label></div>'+
            '<div class="ig-row"><label class="ig-inline"><input type="checkbox" id="i_lut"> Export under LUT (0% IGST)</label></div>'+
          '</div>'+
          '<div class="ig-g2"><div class="ig-row" id="lut_wrap" style="display:none"><label>LUT / ARN number</label><input id="i_lutno"></div><div class="ig-row" id="eway_wrap" style="display:none"><label>E-Way bill no.</label><input id="i_eway"></div></div>'+
          '<div class="ig-row"><label>Currency</label><select id="i_cur"><option value="INR">INR (\u20B9)</option><option value="USD">USD ($)</option></select></div>'+
        '</div>'+
        '<div class="ig-card"><h3>Items</h3>'+
          '<div class="ig-items-head"><span>Description</span><span>HSN/SAC</span><span>Qty</span><span>Unit</span><span>Rate</span><span>Disc%</span><span>GST%</span><span></span></div>'+
          '<div id="ig-items"></div>'+
          '<button class="ig-btn ghost sm" id="addItem">+ Add item</button>'+
        '</div>'+
        '<div class="ig-actions"><button class="ig-btn" id="dlPdf">Download PDF</button><button class="ig-btn ghost" id="prn">Print</button><span class="ig-err" id="igErr"></span></div>'+
      '</div>'+
      '<div class="ig-preview-col"><div class="ig-preview" id="ig-paper"></div></div>'+
    '</div>';
  }

  // ---- state ----
  var root, preset, PK;
  function $(id){ return document.getElementById(id); }

  function itemRow(d){
    d=d||{};
    var tr=document.createElement("div"); tr.className="ig-item";
    tr.innerHTML='<input class="d" placeholder="Item / service"><input class="h" placeholder="HSN">'+
      '<input class="q" type="number" min="0" step="0.01" value="'+(d.qty!=null?d.qty:1)+'">'+
      '<select class="u"></select><input class="r" type="number" min="0" step="0.01" value="'+(d.rate!=null?d.rate:0)+'">'+
      '<input class="disc" type="number" min="0" max="100" step="0.01" value="'+(d.disc!=null?d.disc:0)+'">'+
      '<select class="g"></select><button class="rm" title="Remove">\u00d7</button>';
    $("ig-items").appendChild(tr);
    fillSel(tr.querySelector(".u"),UNITS,d.unit||(preset.unit||"Nos"));
    fillSel(tr.querySelector(".g"),RATES,d.gst!=null?d.gst:(preset.rate!=null?preset.rate:18));
    if(d.desc) tr.querySelector(".d").value=d.desc;
    if(d.sac) tr.querySelector(".h").value=d.sac;
    tr.querySelectorAll("input,select").forEach(function(el){ el.addEventListener("input",calc); });
    tr.querySelector(".rm").onclick=function(){ tr.remove(); calc(); };
    calc();
  }

  function supplierState(){ return $("s_state").value; }

  function readItems(){
    var out=[];
    Array.prototype.forEach.call($("ig-items").children,function(tr){
      var q=num(tr.querySelector(".q").value), rate=num(tr.querySelector(".r").value), disc=num(tr.querySelector(".disc").value);
      var gross=q*rate, discAmt=gross*disc/100, taxable=gross-discAmt;
      out.push({ desc:tr.querySelector(".d").value, hsn:tr.querySelector(".h").value, qty:q, unit:tr.querySelector(".u").value,
        rate:rate, disc:disc, gross:gross, discAmt:discAmt, taxable:taxable, gst:num(tr.querySelector(".g").value) });
    });
    return out;
  }

  function calc(){
    var cur=$("i_cur").value, lut=$("i_lut").checked, rcm=$("i_rcm").checked;
    var pos=$("c_pos").value, ss=supplierState();
    var inter = ss && pos && ss!==pos;
    var items=readItems();
    var sub=0,discTot=0,taxable=0,igst=0,cgst=0,sgst=0;
    items.forEach(function(l){
      sub+=l.gross; discTot+=l.discAmt; taxable+=l.taxable;
      if(lut||rcm) return; // zero tax on invoice
      var tax=l.taxable*l.gst/100;
      if(inter) igst+=tax; else { cgst+=tax/2; sgst+=tax/2; }
    });
    var total=taxable+igst+cgst+sgst;
    var grand=Math.round(total), roundoff=grand-total;
    var t={cur:cur,inter:inter,lut:lut,rcm:rcm,items:items,sub:r2(sub),discTot:r2(discTot),taxable:r2(taxable),igst:r2(igst),cgst:r2(cgst),sgst:r2(sgst),roundoff:r2(roundoff),grand:grand};
    renderPreview(t); return t;
  }

  function renderPreview(t){
    var cur=t.cur, sym=CUR[cur].sym;
    var logo=window.__igLogo? '<img class="pv-logo" src="'+window.__igLogo+'">':'';
    var taxCols = t.inter ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>';
    var rows=t.items.map(function(l,i){
      var tax=(t.lut||t.rcm)?0:l.taxable*l.gst/100;
      var taxCell = t.inter ? '<td>'+fmt(tax,cur)+'</td>' : '<td>'+fmt(tax/2,cur)+'</td><td>'+fmt(tax/2,cur)+'</td>';
      return '<tr><td>'+(i+1)+'</td><td class="l">'+esc(l.desc||"")+'</td><td>'+esc(l.hsn||"")+'</td><td>'+l.qty+' '+esc(l.unit)+'</td><td>'+fmt(l.rate,cur)+'</td><td>'+fmt(l.taxable,cur)+'</td><td>'+l.gst+'%</td>'+taxCell+'</tr>';
    }).join("");
    var decl="";
    if(t.lut) decl='<div class="pv-decl">'+esc(preset.note||"Supply meant for export under LUT/Bond without payment of IGST (Rule 96A).")+ ($("i_lutno").value?' LUT/ARN: '+esc($("i_lutno").value):'')+'</div>';
    else if(t.rcm) decl='<div class="pv-decl">'+esc(preset.note||"GST payable by recipient under Reverse Charge (RCM).")+'</div>';
    var shipHtml = $("c_ship_diff").checked && $("c_ship").value ? '<div class="pv-sub">Ship to: '+esc($("c_ship").value)+'</div>' : '';
    var totRows='<tr><td>Taxable value</td><td>'+fmt(t.taxable,cur)+'</td></tr>';
    if(!t.lut&&!t.rcm){ if(t.inter) totRows+='<tr><td>IGST</td><td>'+fmt(t.igst,cur)+'</td></tr>'; else totRows+='<tr><td>CGST</td><td>'+fmt(t.cgst,cur)+'</td></tr><tr><td>SGST</td><td>'+fmt(t.sgst,cur)+'</td></tr>'; }
    if(Math.abs(t.roundoff)>=0.005) totRows+='<tr><td>Round off</td><td>'+(t.roundoff<0?"-":"")+fmt(Math.abs(t.roundoff),cur)+'</td></tr>';
    totRows+='<tr class="gt"><td>Total</td><td>'+fmt(t.grand,cur)+'</td></tr>';

    $("ig-paper").innerHTML=''+
      '<div class="pv-top">'+logo+'<div class="pv-title">TAX INVOICE</div></div>'+
      '<div class="pv-parties"><div class="pv-seller"><b>'+esc($("s_name").value||"Your Business")+'</b>'+
        ($("s_addr").value?'<div>'+esc($("s_addr").value).replace(/\n/g,"<br>")+'</div>':'')+
        ($("s_gstin").value?'<div>GSTIN: '+esc($("s_gstin").value.toUpperCase())+'</div>':'')+
        ($("s_pan").value?'<div>PAN: '+esc($("s_pan").value.toUpperCase())+'</div>':'')+
        '<div>State: '+supplierState()+' - '+esc(stateName(supplierState()))+'</div></div>'+
      '<div class="pv-meta"><div><span>Invoice</span> '+esc($("i_num").value||"")+'</div><div><span>Date</span> '+esc(($("i_date").value||"").split("-").reverse().join("-"))+'</div>'+
        ($("i_due").value?'<div><span>Due</span> '+esc($("i_due").value.split("-").reverse().join("-"))+'</div>':'')+
        ($("i_eway").value?'<div><span>E-Way</span> '+esc($("i_eway").value)+'</div>':'')+'</div></div>'+
      '<div class="pv-billto"><b>Bill to</b> '+esc($("c_name").value||"Customer")+
        ($("c_gstin").value?' &#183; GSTIN '+esc($("c_gstin").value.toUpperCase()):'')+
        ($("c_addr").value?'<div class="pv-sub">'+esc($("c_addr").value).replace(/\n/g,"<br>")+'</div>':'')+shipHtml+
        '<div class="pv-sub">Place of supply: '+$("c_pos").value+' - '+esc(stateName($("c_pos").value))+'</div></div>'+
      '<table class="pv-items"><thead><tr><th>#</th><th class="l">Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>GST</th>'+taxCols+'</tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="pv-foot"><div class="pv-words">'+esc(moneyWords(t.grand,cur))+'</div><table class="pv-tot"><tbody>'+totRows+'</tbody></table></div>'+
      decl+
      ($("s_email").value||$("s_phone").value?'<div class="pv-contact">'+esc([$("s_email").value,$("s_phone").value].filter(Boolean).join(" &#183; "))+'</div>':'')+
      '<div class="pv-sign">For <b>'+esc($("s_name").value||"Your Business")+'</b><br><br>Authorised Signatory</div>';
  }

  // ---- PDF (vector, jsPDF) ----
  function genPDF(){
    $("igErr").textContent="";
    if(!$("s_name").value){ $("igErr").textContent="Enter your business name."; return; }
    if(!$("c_name").value){ $("igErr").textContent="Enter the customer name."; return; }
    var t=calc(); if(!t.items.length||t.taxable<=0){ $("igErr").textContent="Add at least one item with an amount."; return; }
    if(!jspdfReady()){ $("igErr").textContent="PDF library still loading — try again in a second."; return; }
    var jsPDF=window.jspdf.jsPDF, doc=new jsPDF({unit:"pt",format:"a4"});
    var W=doc.internal.pageSize.getWidth(), M=40, y=46, cur=t.cur;
    function money(n){ return CUR[cur].sym==="\u20B9"?("Rs "+(Number(n)||0).toFixed(2)):("$"+(Number(n)||0).toFixed(2)); }
    if(window.__igLogo){ try{ doc.addImage(window.__igLogo,"PNG",M,y-18,54,54);}catch(e){} }
    doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("TAX INVOICE", W-M, y, {align:"right"}); y+=18;
    doc.setFontSize(12); doc.text($("s_name").value, window.__igLogo?M+66:M, y); y+=14;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(90);
    var lx=window.__igLogo?M+66:M;
    ($("s_addr").value||"").split(/\n/).forEach(function(l){ if(l.trim()){doc.text(l.trim(),lx,y);y+=11;} });
    if($("s_gstin").value){ doc.text("GSTIN: "+$("s_gstin").value.toUpperCase(),lx,y); y+=11; }
    if($("s_pan").value){ doc.text("PAN: "+$("s_pan").value.toUpperCase(),lx,y); y+=11; }
    doc.text("State: "+supplierState()+" - "+stateName(supplierState()),lx,y); y+=11;
    doc.setTextColor(20);
    var ry=64; doc.setFontSize(9);
    function meta(k,v){ if(!v)return; doc.setFont("helvetica","normal"); doc.text(k,W-M-150,ry); doc.setFont("helvetica","bold"); doc.text(String(v),W-M,ry,{align:"right"}); ry+=13; }
    meta("Invoice No",$("i_num").value); meta("Date",($("i_date").value||"").split("-").reverse().join("-")); meta("Due",($("i_due").value||"").split("-").reverse().join("-")); meta("Terms",$("i_terms").value); meta("E-Way Bill",$("i_eway").value);
    y=Math.max(y,ry)+6; doc.setDrawColor(220); doc.line(M,y,W-M,y); y+=16;
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.text("Bill to",M,y); y+=13;
    doc.setFont("helvetica","normal"); doc.text($("c_name").value,M,y); y+=12; doc.setFontSize(9); doc.setTextColor(90);
    ($("c_addr").value||"").split(/\n/).forEach(function(l){ if(l.trim()){doc.text(l.trim(),M,y);y+=11;} });
    if($("c_gstin").value){ doc.text("GSTIN: "+$("c_gstin").value.toUpperCase(),M,y); y+=11; }
    if($("c_ship_diff").checked&&$("c_ship").value){ doc.text("Ship to: "+$("c_ship").value.replace(/\n/g,", "),M,y); y+=11; }
    doc.text("Place of supply: "+$("c_pos").value+" - "+stateName($("c_pos").value),M,y); y+=14; doc.setTextColor(20);

    var head,body;
    if(t.lut||t.rcm){ head=[["#","Description","HSN","Qty","Rate","Taxable","GST%","Tax"]];
      body=t.items.map(function(l,i){ return [i+1,l.desc,l.hsn||"",l.qty+" "+l.unit,l.rate.toFixed(2),l.taxable.toFixed(2),l.gst+"%","0.00"]; }); }
    else if(t.inter){ head=[["#","Description","HSN","Qty","Rate","Taxable","IGST%","IGST"]];
      body=t.items.map(function(l,i){ var tax=l.taxable*l.gst/100; return [i+1,l.desc,l.hsn||"",l.qty+" "+l.unit,l.rate.toFixed(2),l.taxable.toFixed(2),l.gst+"%",tax.toFixed(2)]; }); }
    else { head=[["#","Description","HSN","Qty","Rate","Taxable","CGST","SGST"]];
      body=t.items.map(function(l,i){ var tax=l.taxable*l.gst/100; return [i+1,l.desc,l.hsn||"",l.qty+" "+l.unit,l.rate.toFixed(2),l.taxable.toFixed(2),(tax/2).toFixed(2),(tax/2).toFixed(2)]; }); }
    doc.autoTable({ startY:y, head:head, body:body, margin:{left:M,right:M}, styles:{fontSize:8,cellPadding:3.5}, headStyles:{fillColor:[91,75,224],textColor:255,fontSize:7.5}, columnStyles:{0:{cellWidth:18}} });
    var ty=doc.lastAutoTable.finalY+16;
    function tl(l,v,b){ doc.setFont("helvetica",b?"bold":"normal"); doc.setFontSize(b?11:9.5); doc.text(l,W-M-170,ty); doc.text(v,W-M,ty,{align:"right"}); ty+=b?18:14; }
    tl("Taxable value",money(t.taxable));
    if(!t.lut&&!t.rcm){ if(t.inter) tl("IGST",money(t.igst)); else { tl("CGST",money(t.cgst)); tl("SGST",money(t.sgst)); } }
    if(Math.abs(t.roundoff)>=0.005) tl("Round off",(t.roundoff<0?"-":"")+money(Math.abs(t.roundoff)));
    tl("Total",money(t.grand),true);
    var by=ty+8; doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60);
    doc.text("Amount in words: "+moneyWords(t.grand,cur),M,by,{maxWidth:W-2*M}); by+=20;
    if(t.lut){ doc.setFontSize(8); doc.text((preset.note||"Supply meant for export under LUT/Bond without payment of IGST (Rule 96A).")+($("i_lutno").value?" LUT/ARN: "+$("i_lutno").value:""),M,by,{maxWidth:W-2*M}); by+=20; }
    if(t.rcm){ doc.setFontSize(8); doc.text(preset.note||"GST payable by recipient under Reverse Charge (RCM).",M,by,{maxWidth:W-2*M}); by+=20; }
    doc.setTextColor(20); doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.text("For "+$("s_name").value,W-M,by,{align:"right"}); by+=30;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text("Authorised Signatory",W-M,by,{align:"right"});
    doc.setFontSize(7.5); doc.setTextColor(150); doc.text("Generated free at invoice2gst.com",M,doc.internal.pageSize.getHeight()-26);
    doc.save(("Invoice_"+($("i_num").value||"draft")).replace(/[^\w\-]+/g,"_")+".pdf");
  }

  // ---- persistence ----
  function saveBiz(){ try{ localStorage.setItem("i2g_biz",JSON.stringify({name:$("s_name").value,gstin:$("s_gstin").value,pan:$("s_pan").value,addr:$("s_addr").value,state:$("s_state").value,email:$("s_email").value,phone:$("s_phone").value,logo:window.__igLogo||""})); $("bizOk").textContent="Saved \u2713"; setTimeout(function(){$("bizOk").textContent="";},1800);}catch(e){} }
  function loadBiz(){ try{ var b=JSON.parse(localStorage.getItem("i2g_biz")||"null"); if(!b)return; $("s_name").value=b.name||"";$("s_gstin").value=b.gstin||"";$("s_pan").value=b.pan||"";$("s_addr").value=b.addr||"";if(b.state)$("s_state").value=b.state;$("s_email").value=b.email||"";$("s_phone").value=b.phone||"";if(b.logo){window.__igLogo=b.logo;} }catch(e){} }

  // ---- preset application ----
  function applyPreset(){
    if(preset.currency) $("i_cur").value=preset.currency;
    if(preset.lut){ $("i_lut").checked=true; $("lut_wrap").style.display=""; }
    if(preset.rcm){ $("i_rcm").checked=true; }
    if(preset.eway){ $("eway_wrap").style.display=""; }
  }
  function seedItems(){
    if(preset.items){ preset.items.forEach(function(it){ itemRow({desc:it.desc,sac:it.sac,rate:0,gst:it.rate,unit:preset.unit}); }); }
    else { itemRow({desc:preset.item||"",sac:preset.sac||"",gst:preset.rate,unit:preset.unit}); }
  }

  function bind(){
    $("addItem").onclick=function(){ itemRow({}); };
    $("dlPdf").onclick=genPDF;
    $("prn").onclick=function(){ window.print(); };
    $("saveBiz").onclick=saveBiz;
    $("c_ship_diff").onchange=function(){ $("c_ship_wrap").style.display=this.checked?"":"none"; calc(); };
    $("i_lut").onchange=function(){ $("lut_wrap").style.display=this.checked?"":"none"; if(this.checked)$("i_rcm").checked=false; calc(); };
    $("i_rcm").onchange=function(){ if(this.checked)$("i_lut").checked=false; $("lut_wrap").style.display=$("i_lut").checked?"":"none"; calc(); };
    ["s_name","s_gstin","s_pan","s_addr","s_state","s_email","s_phone","c_name","c_gstin","c_pos","c_addr","c_ship","i_num","i_date","i_due","i_terms","i_lutno","i_eway","i_cur"].forEach(function(id){ var el=$(id); if(el) el.addEventListener("input",calc); });
    $("s_logo").onchange=function(){ var f=this.files[0]; if(!f)return; var rd=new FileReader(); rd.onload=function(){ window.__igLogo=rd.result; calc(); }; rd.readAsDataURL(f); };
    document.querySelectorAll("#ig-app .up").forEach(function(el){ el.addEventListener("input",function(){ this.value=this.value.toUpperCase(); }); });
  }

  function init(){
    root=$("ig-app"); if(!root) return;
    PK=(root.getAttribute("data-preset")||"generic"); preset=PRESETS[PK]||PRESETS.generic;
    root.innerHTML=tpl();
    fillSel($("s_state"),STATES,"06"); fillSel($("c_pos"),STATES,"06");
    $("i_date").value=new Date().toISOString().slice(0,10);
    $("i_num").value="INV-001";
    bind(); loadBiz(); applyPreset(); seedItems(); calc();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();

  // expose config for reference/testing
  window.IG = { PRESETS:PRESETS, STATES:STATES, calcWords:moneyWords, buildTaxes:null };
})();
