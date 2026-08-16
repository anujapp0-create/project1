/* invoice2gst — GST Invoice Generator v2 (Refrens-grade)
   Mounts into #ig-app, reads data-preset attribute. */
(function () {
  "use strict";

  // ---- data ----
  var STATES=[["01","Jammu & Kashmir"],["02","Himachal Pradesh"],["03","Punjab"],["04","Chandigarh"],["05","Uttarakhand"],["06","Haryana"],["07","Delhi"],["08","Rajasthan"],["09","Uttar Pradesh"],["10","Bihar"],["11","Sikkim"],["12","Arunachal Pradesh"],["13","Nagaland"],["14","Manipur"],["15","Mizoram"],["16","Tripura"],["17","Meghalaya"],["18","Assam"],["19","West Bengal"],["20","Jharkhand"],["21","Odisha"],["22","Chhattisgarh"],["23","Madhya Pradesh"],["24","Gujarat"],["26","Dadra & Nagar Haveli and Daman & Diu"],["27","Maharashtra"],["29","Karnataka"],["30","Goa"],["31","Lakshadweep"],["32","Kerala"],["33","Tamil Nadu"],["34","Puducherry"],["35","Andaman & Nicobar Islands"],["36","Telangana"],["37","Andhra Pradesh"],["38","Ladakh"],["97","Other Territory"]];
  var UNITS=["Nos","Pcs","Kgs","Hours","Ltr","Mtr","Sqft","Set","Box","Unit","Day","Month"];
  var GST_RATES=[0,0.1,0.25,1,1.5,3,5,6,7.5,12,18,28];
  var THEMES=[{id:"classic",color:"#5b4be0",label:"Indigo"},{id:"green",color:"#0d9d6c",label:"Green"},{id:"slate",color:"#334155",label:"Slate"}];
  var PRESETS={
    "generic":{unit:"Nos",rate:18},
    "export-invoice-lut":{currency:"USD",lut:true,rate:0,unit:"Nos",note:"Supply meant for export under LUT/Bond without payment of IGST (Rule 96A of CGST Rules)."},
    "freelance-it-consultant":{sac:"9983",rate:18,unit:"Hours",item:"Software / consulting services"},
    "manpower-staffing-agency":{sac:"9985",rate:18,unit:"Nos",items:[{desc:"Staff wages / reimbursement",sac:"9985",gst:18},{desc:"Agency service charge",sac:"9985",gst:18}]},
    "transporter-gta":{sac:"9965",rcm:true,rate:0,unit:"Nos",item:"Goods transport service (GTA)",note:"GST payable by recipient under Reverse Charge (RCM). Sec 9(3) / Notif. 13/2017-CT(R)."},
    "b2b-tax-invoice":{rate:18,unit:"Nos",eway:true}
  };

  // ---- helpers ----
  function $(id){return document.getElementById(id);}
  function val(id){var e=$(id);return e?e.value:"";}
  function chk(id){var e=$(id);return e?e.checked:false;}
  function num(x){var n=parseFloat(x);return isNaN(n)?0:n;}
  function r2(n){return Math.round((n||0)*100)/100;}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function stateName(c){for(var i=0;i<STATES.length;i++)if(STATES[i][0]===c)return STATES[i][1];return "";}
  function fillSel(sel,opts,def){sel.innerHTML="";opts.forEach(function(o){var v=Array.isArray(o)?o[0]:o,t=Array.isArray(o)?o[0]+" - "+o[1]:String(o);var e=document.createElement("option");e.value=v;e.textContent=t;sel.appendChild(e);});if(def!=null)sel.value=def;}

  // ---- number → words ----
  var o1=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  var t1=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function two(x){return x<20?o1[x]:t1[Math.floor(x/10)]+(x%10?" "+o1[x%10]:"");}
  function three(x){var h=Math.floor(x/100),r=x%100;return (h?o1[h]+" Hundred"+(r?" ":""):"")+(r?two(r):"");}
  function indWords(n){n=Math.round(Math.abs(n));if(!n)return "Zero";var out="",cr=Math.floor(n/1e7);n%=1e7;var la=Math.floor(n/1e5);n%=1e5;var th=Math.floor(n/1e3);n%=1e3;if(cr)out+=two(cr)+" Crore ";if(la)out+=two(la)+" Lakh ";if(th)out+=two(th)+" Thousand ";if(n)out+=three(n);return out.trim();}
  function intWords(n){n=Math.round(Math.abs(n));if(!n)return "Zero";var g=[["Billion",1e9],["Million",1e6],["Thousand",1e3]],out="";g.forEach(function(x){var v=Math.floor(n/x[1]);if(v){out+=three(v)+" "+x[0]+" ";n%=x[1];}});if(n)out+=three(n);return out.trim();}
  function moneyWords(amt,cur){var fn=cur==="USD"?intWords:indWords;var r=Math.floor(amt),p=Math.round((amt-r)*100);var unit=cur==="USD"?"US Dollars":"Rupees",sub=cur==="USD"?"Cents":"Paise";var s=(cur==="USD"?"USD ":"INR ")+fn(r)+" "+unit;if(p)s+=" and "+fn(p)+" "+sub;return s+" Only";}

  // ---- state ----
  var preset={},PK="generic",theme="classic",logoData=null;
  var invNum=1,prefix="INV-";

  // ---- build UI ----
  function buildUI(root){
    root.className="ig-form";
    root.innerHTML=
      // Supplier
      '<div class="ig-panel" style="margin-bottom:14px">'+
        '<div class="ig-panel-head"><h3><svg viewBox="0 0 24 24" fill="none"><path d="M3 21h18M3 7l9-4 9 4v14" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><rect x="9" y="13" width="6" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Your Business (Supplier)</h3><button class="ig-btn outline" id="saveBiz" style="padding:6px 12px;font-size:12px">Save details</button></div>'+
        '<div class="ig-sec">'+
          '<div class="ig-row"><label>Business / legal name *</label><input id="s_name" placeholder="TaxTrack Solutions"></div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label>GSTIN</label><input id="s_gstin" class="up" maxlength="15" placeholder="06AAAAA0000A1Z5"></div>'+
            '<div class="ig-row"><label>PAN</label><input id="s_pan" class="up" maxlength="10" placeholder="AAAAA0000A"></div>'+
          '</div>'+
          '<div class="ig-row"><label>Address</label><textarea id="s_addr" rows="2" placeholder="Shed No 2, Malerna Road, Ballabgarh, Faridabad, Haryana - 121004"></textarea></div>'+
          '<div class="ig-g3">'+
            '<div class="ig-row"><label>State</label><select id="s_state"></select></div>'+
            '<div class="ig-row"><label>Email</label><input id="s_email" type="email"></div>'+
            '<div class="ig-row"><label>Phone</label><input id="s_phone"></div>'+
          '</div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label>Bank &amp; A/c (optional)</label><input id="s_bank" placeholder="IDBI Bank · A/c 0885102000018975"></div>'+
            '<div class="ig-row"><label>IFSC (optional)</label><input id="s_ifsc"></div>'+
          '</div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label>Invoice prefix</label><input id="s_prefix" value="INV-"></div>'+
            '<div class="ig-row"><label>Next invoice no.</label><input id="s_next" type="number" min="1" value="1"></div>'+
          '</div>'+
          '<div class="ig-row"><label>Logo</label><input id="s_logo" type="file" accept="image/*"></div>'+
          '<span class="ig-ok" id="bizOk"></span>'+
        '</div>'+
      '</div>'+
      // Customer
      '<div class="ig-panel" style="margin-bottom:14px">'+
        '<div class="ig-panel-head"><h3><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>Customer (Bill to)</h3></div>'+
        '<div class="ig-sec">'+
          '<div class="ig-row"><label>Customer / company name *</label><input id="c_name"></div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label>Customer GSTIN</label><input id="c_gstin" class="up" maxlength="15" placeholder="Leave blank if unregistered"></div>'+
            '<div class="ig-row"><label>Place of supply *</label><select id="c_pos"></select></div>'+
          '</div>'+
          '<div class="ig-row"><label>Billing address</label><textarea id="c_addr" rows="2"></textarea></div>'+
          '<div class="ig-row"><label><label class="toggle-lbl"><span>Different shipping address</span><label class="tgl"><input type="checkbox" id="c_shipdiff"><span class="tgl-sl"></span></label></label></label></div>'+
          '<div id="c_shipwrap" style="display:none" class="ig-row"><label>Shipping address</label><textarea id="c_ship" rows="2"></textarea></div>'+
        '</div>'+
      '</div>'+
      // Invoice details
      '<div class="ig-panel" style="margin-bottom:14px">'+
        '<div class="ig-panel-head"><h3><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Invoice Details</h3></div>'+
        '<div class="ig-sec">'+
          '<div class="ig-g3">'+
            '<div class="ig-row"><label>Invoice no.</label><input id="i_num"></div>'+
            '<div class="ig-row"><label>Invoice date</label><input id="i_date" type="date"></div>'+
            '<div class="ig-row"><label>Due date</label><input id="i_due" type="date"></div>'+
          '</div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label>Payment terms</label><input id="i_terms" placeholder="Net 15"></div>'+
            '<div class="ig-row"><label>Currency</label><select id="i_cur"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option></select></div>'+
          '</div>'+
          '<div class="ig-g2">'+
            '<div class="ig-row"><label><label class="toggle-lbl"><span>Reverse charge (RCM)</span><label class="tgl"><input type="checkbox" id="i_rcm"><span class="tgl-sl"></span></label></label></label></div>'+
            '<div class="ig-row"><label><label class="toggle-lbl"><span>Export under LUT (0% IGST)</span><label class="tgl"><input type="checkbox" id="i_lut"><span class="tgl-sl"></span></label></label></label></div>'+
          '</div>'+
          '<div class="ig-g2">'+
            '<div id="lut_wrap" style="display:none" class="ig-row"><label>LUT / ARN number</label><input id="i_lutno"></div>'+
            '<div id="eway_wrap" style="display:none" class="ig-row"><label>E-Way bill no.</label><input id="i_eway"></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      // Line items
      '<div class="ig-panel" style="margin-bottom:14px">'+
        '<div class="ig-panel-head"><h3><svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke="currentColor" stroke-width="1.6"/></svg>Items</h3></div>'+
        '<div class="ig-sec">'+
          '<div class="ig-items-wrap">'+
            '<div class="ig-items-head"><span>Description</span><span>HSN/SAC</span><span>Qty</span><span>Unit</span><span>Rate</span><span>Disc%</span><span>GST%</span><span></span></div>'+
            '<div id="ig-items"></div>'+
          '</div>'+
          '<button class="ig-btn outline" id="addItem" style="margin-top:10px;padding:8px 14px;font-size:13px">+ Add item</button>'+
          '<div class="ig-g2" style="margin-top:16px">'+
            '<div class="ig-row"><label>Invoice-level discount (%)</label><input id="i_discpct" type="number" min="0" max="100" step="0.01" value="0"></div>'+
            '<div class="ig-row"><label>Invoice-level discount (₹)</label><input id="i_discamt" type="number" min="0" step="0.01" value="0"></div>'+
          '</div>'+
          '<div id="ig-totals" class="ig-totals"></div>'+
        '</div>'+
      '</div>'+
      // Notes
      '<div class="ig-panel" style="margin-bottom:14px">'+
        '<div class="ig-panel-head"><h3><svg viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>Notes &amp; Terms</h3></div>'+
        '<div class="ig-sec ig-g2">'+
          '<div class="ig-row"><label>Notes (shown on invoice)</label><textarea id="i_notes" rows="3" placeholder="e.g. Thank you for your business!"></textarea></div>'+
          '<div class="ig-row"><label>Terms &amp; conditions</label><textarea id="i_terms2" rows="3" placeholder="e.g. Payment due within 15 days."></textarea></div>'+
        '</div>'+
      '</div>'+
      // Actions
      '<div class="ig-actions">'+
        '<button class="ig-btn primary" id="dlPdf"><svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 12-4-4m4 4 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>Download PDF</button>'+
        '<button class="ig-btn outline" id="prn"><svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" stroke="currentColor" stroke-width="1.7"/><rect x="6" y="14" width="12" height="7" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>Print</button>'+
        '<div id="ig-err" class="ig-err"></div>'+
      '</div>';
  }

  function buildPreview(col){
    col.innerHTML=
      '<div class="ig-preview-shell">'+
        '<div class="ig-preview-toolbar">'+
          '<span>Invoice preview — updates live</span>'+
          '<div class="tb-btns">'+
            '<button class="tb-btn" id="tPrn"><svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" stroke="currentColor" stroke-width="1.7"/><rect x="6" y="14" width="12" height="7" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>Print</button>'+
            '<button class="tb-btn prim" id="tDl"><svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 12-4-4m4 4 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>Download PDF</button>'+
          '</div>'+
        '</div>'+
        '<div class="ig-a4 theme-'+theme+'" id="ig-paper"></div>'+
      '</div>';
  }

  function addItemRow(d){
    d=d||{};
    var row=document.createElement("div"); row.className="ig-item-row";
    row.innerHTML=
      '<input class="d" placeholder="Item/service description">'+
      '<input class="h" placeholder="HSN">'+
      '<input class="q" type="number" min="0" step="0.01" value="'+(d.qty!=null?d.qty:1)+'">'+
      '<select class="u"></select>'+
      '<input class="r" type="number" min="0" step="0.01" value="'+(d.unitRate!=null?d.unitRate:0)+'">'+
      '<input class="di" type="number" min="0" max="100" step="0.01" value="0">'+
      '<select class="g"></select>'+
      '<button class="rm-btn" title="Remove">\u00d7</button>';
    $("ig-items").appendChild(row);
    fillSel(row.querySelector(".u"),UNITS,d.unit||(preset.unit||"Nos"));
    fillSel(row.querySelector(".g"),GST_RATES,d.gst!=null?d.gst:(preset.rate!=null?preset.rate:18));
    if(d.desc) row.querySelector(".d").value=d.desc;
    if(d.sac)  row.querySelector(".h").value=d.sac;
    row.querySelectorAll("input,select").forEach(function(el){el.addEventListener("input",recalc);});
    row.querySelector(".rm-btn").onclick=function(){row.remove();recalc();};
    recalc();
  }

  function readItems(){
    var out=[];
    Array.prototype.forEach.call($("ig-items").children,function(row){
      var q=num(row.querySelector(".q").value),rate=num(row.querySelector(".r").value),disc=num(row.querySelector(".di").value);
      var gross=q*rate, discAmt=gross*disc/100, taxable=gross-discAmt;
      out.push({desc:row.querySelector(".d").value,hsn:row.querySelector(".h").value,unit:row.querySelector(".u").value,qty:q,rate:rate,disc:disc,gross:gross,discAmt:r2(discAmt),taxable:r2(taxable),gst:num(row.querySelector(".g").value)});
    });
    return out;
  }

  function recalc(){
    var cur=val("i_cur")||"INR", lut=chk("i_lut"), rcm=chk("i_rcm");
    var pos=val("c_pos"),ss=val("s_state"), inter=ss&&pos&&ss!==pos;
    var items=readItems();
    var subGross=0,itemDisc=0,taxable=0,igst=0,cgst=0,sgst=0;
    items.forEach(function(l){subGross+=l.gross;itemDisc+=l.discAmt;taxable+=l.taxable;
      if(lut||rcm)return; var t=l.taxable*l.gst/100; if(inter)igst+=t;else{cgst+=t/2;sgst+=t/2;}});
    // invoice-level discount
    var iDiscPct=Math.min(100,Math.max(0,num(val("i_discpct")))),iDiscAmt=num(val("i_discamt"));
    if(iDiscPct>0){var d=taxable*iDiscPct/100;iDiscAmt=r2(d);if($("i_discamt"))$("i_discamt").value=iDiscAmt;}
    taxable=r2(taxable-iDiscAmt);
    // recompute tax on adjusted taxable
    if(!lut&&!rcm){igst=0;cgst=0;sgst=0;items.forEach(function(l){var adjTax=(l.taxable/Math.max(1,items.reduce(function(s,x){return s+x.taxable;},0)))*taxable*l.gst/100;if(inter)igst+=adjTax;else{cgst+=adjTax/2;sgst+=adjTax/2;}});}
    var total=taxable+(lut||rcm?0:igst+cgst+sgst), grand=Math.round(total), ro=r2(grand-total);
    var sym=cur==="USD"?"$":"\u20B9";
    function fmt(n){return sym+(n||0).toLocaleString(cur==="USD"?"en-US":"en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});}
    // update totals box
    var badge=lut?'<span class="tax-badge zero">Zero-rated / LUT</span>':rcm?'<span class="tax-badge zero">RCM — tax paid by recipient</span>':inter?'<span class="tax-badge inter">IGST (inter-state)</span>':'<span class="tax-badge intra">CGST + SGST (intra-state)</span>';
    var html='<div class="tot-row"><span class="tot-lbl">Subtotal (before disc)</span><span>'+fmt(subGross)+'</span></div>';
    if(itemDisc>0||iDiscAmt>0) html+='<div class="tot-row"><span class="tot-lbl">Discount</span><span style="color:#b04848">- '+fmt(r2(itemDisc+iDiscAmt))+'</span></div>';
    html+='<div class="tot-row"><span class="tot-lbl">Taxable value '+badge+'</span><span>'+fmt(taxable)+'</span></div>';
    if(!lut&&!rcm){if(inter)html+='<div class="tot-row"><span class="tot-lbl">IGST</span><span>'+fmt(r2(igst))+'</span></div>';else html+='<div class="tot-row"><span class="tot-lbl">CGST</span><span>'+fmt(r2(cgst))+'</span></div><div class="tot-row"><span class="tot-lbl">SGST</span><span>'+fmt(r2(sgst))+'</span></div>';}
    if(Math.abs(ro)>=0.005) html+='<div class="tot-row"><span class="tot-lbl">Round off</span><span>'+(ro<0?"- ":"")+fmt(Math.abs(ro))+'</span></div>';
    html+='<div class="tot-row grand"><span>Total</span><span class="amt">'+fmt(grand)+'</span></div><div class="tot-words">'+esc(moneyWords(grand,cur))+'</div>';
    $("ig-totals").innerHTML=html;
    renderPreview({cur:cur,sym:sym,inter:!!inter,lut:lut,rcm:rcm,items:items,subGross:r2(subGross),itemDisc:r2(itemDisc),iDiscAmt:iDiscAmt,taxable:taxable,igst:r2(igst),cgst:r2(cgst),sgst:r2(sgst),ro:ro,grand:grand,fmt:fmt});
    return {cur:cur,sym:sym,inter:inter,lut:lut,rcm:rcm,items:items,subGross:subGross,taxable:taxable,igst:r2(igst),cgst:r2(cgst),sgst:r2(sgst),grand:grand,ro:ro,fmt:fmt};
  }

  function renderPreview(t){
    var paper=$("ig-paper"); if(!paper) return;
    paper.className="ig-a4 theme-"+theme;
    var tc=THEMES.filter(function(x){return x.id===theme;})[0];
    var color=tc?tc.color:"#5b4be0";
    paper.style.setProperty("--tc",color);
    var logoHtml=logoData?'<img class="pv-logo" src="'+logoData+'" alt="logo">':'<div></div>';
    var metaRows='<div><span class="mk">Invoice No.&nbsp;</span><b>'+esc(val("i_num")||"—")+'</b></div>';
    var dt=val("i_date"); if(dt) metaRows+='<div><span class="mk">Date&nbsp;</span>'+dt.split("-").reverse().join("-")+'</div>';
    var dd=val("i_due"); if(dd) metaRows+='<div><span class="mk">Due&nbsp;</span>'+dd.split("-").reverse().join("-")+'</div>';
    var ew=val("i_eway"); if(ew) metaRows+='<div><span class="mk">E-Way&nbsp;</span>'+esc(ew)+'</div>';
    var sellerGST=val("s_gstin"),sellerPAN=val("s_pan"),sellerState=val("s_state");
    var sellerSub='';
    if(val("s_addr")) sellerSub+=esc(val("s_addr")).replace(/\n/g,"<br>");
    if(sellerGST) sellerSub+=(sellerSub?"<br>":"")+"GSTIN: "+esc(sellerGST.toUpperCase());
    if(sellerPAN) sellerSub+=(sellerSub?"<br>":"")+"PAN: "+esc(sellerPAN.toUpperCase());
    if(sellerState) sellerSub+=(sellerSub?"<br>":"")+"State: "+sellerState+" — "+esc(stateName(sellerState));
    var cgstin=val("c_gstin"), cpos=val("c_pos");
    var custSub='';
    if(val("c_addr")) custSub+=esc(val("c_addr")).replace(/\n/g,"<br>");
    if(cgstin) custSub+=(custSub?"<br>":"")+"GSTIN: "+esc(cgstin.toUpperCase());
    if(cpos)   custSub+=(custSub?"<br>":"")+"Place of supply: "+cpos+" — "+esc(stateName(cpos));
    if(chk("c_shipdiff")&&val("c_ship")) custSub+=(custSub?"<br>":"")+"Ship to: "+esc(val("c_ship"));
    // items table
    var taxCols=t.inter?'<th>IGST%</th><th>IGST</th>':'<th>CGST</th><th>SGST</th>';
    var itemRows=t.items.map(function(l,i){
      if(!t.lut&&!t.rcm){
        var tax=l.taxable*l.gst/100;
        var taxCells=t.inter?'<td>'+l.gst+'%</td><td>'+t.fmt(tax)+'</td>':'<td>'+t.fmt(tax/2)+'</td><td>'+t.fmt(tax/2)+'</td>';
        return '<tr><td>'+(i+1)+'</td><td>'+esc(l.desc||"")+(l.hsn?'<br><small style="color:#98a0b3">HSN: '+esc(l.hsn)+'</small>':'')+'</td><td style="white-space:nowrap">'+l.qty+' '+esc(l.unit)+'</td><td>'+t.fmt(l.rate)+'</td><td>'+t.fmt(l.taxable)+'</td>'+taxCells+'</tr>';
      }
      return '<tr><td>'+(i+1)+'</td><td>'+esc(l.desc||"")+(l.hsn?'<br><small style="color:#98a0b3">HSN: '+esc(l.hsn)+'</small>':'')+'</td><td style="white-space:nowrap">'+l.qty+' '+esc(l.unit)+'</td><td>'+t.fmt(l.rate)+'</td><td>'+t.fmt(l.taxable)+'</td><td colspan="2" style="color:#98a0b3">—</td></tr>';
    }).join("");
    // sums
    var sumRows='<tr><td>Taxable</td><td>'+t.fmt(t.taxable)+'</td></tr>';
    if(!t.lut&&!t.rcm){if(t.inter) sumRows+='<tr><td>IGST</td><td>'+t.fmt(t.igst)+'</td></tr>';else sumRows+='<tr><td>CGST</td><td>'+t.fmt(t.cgst)+'</td></tr><tr><td>SGST</td><td>'+t.fmt(t.sgst)+'</td></tr>';}
    if(Math.abs(t.ro)>=0.005) sumRows+='<tr><td>Round off</td><td>'+(t.ro<0?"- ":"")+t.fmt(Math.abs(t.ro))+'</td></tr>';
    sumRows+='<tr class="grand"><td>Total</td><td>'+t.fmt(t.grand)+'</td></tr>';
    var decl="";
    if(t.lut) decl='<div class="pv-decl">'+esc((preset.note||"Supply meant for export under LUT/Bond without payment of IGST (Rule 96A).")+(val("i_lutno")?" LUT/ARN: "+val("i_lutno"):""))+'</div>';
    else if(t.rcm) decl='<div class="pv-decl">'+esc(preset.note||"GST payable by recipient under Reverse Charge (RCM).")+'</div>';
    var notes=val("i_notes"),terms=val("i_terms2");
    var notesHtml="";
    if(notes||terms) notesHtml='<div class="pv-notes">'+(notes?'<b>Notes:</b> '+esc(notes)+'<br>':'')+(terms?'<b>Terms:</b> '+esc(terms):'')+'</div>';
    var bankHtml="";
    if(val("s_bank")||val("s_ifsc")) bankHtml='<div style="font-size:9.5px;color:#5b6377;margin-top:10px">Bank: '+esc(val("s_bank"))+(val("s_ifsc")?" · IFSC: "+esc(val("s_ifsc")):"")+'</div>';
    paper.innerHTML=
      '<div class="pv-head">'+logoHtml+
        '<div class="pv-title-block"><div class="t1">TAX INVOICE</div><div class="t2">Original for recipient</div></div>'+
        '<div class="pv-meta">'+metaRows+'</div>'+
      '</div>'+
      '<div class="pv-divider"></div>'+
      '<div class="pv-parties">'+
        '<div><div class="pv-party-label">From</div><div class="pv-party-name">'+esc(val("s_name")||"Your Business")+'</div><div class="pv-party-sub">'+sellerSub+'</div></div>'+
        '<div><div class="pv-party-label">Bill to</div><div class="pv-party-name">'+esc(val("c_name")||"Customer")+'</div><div class="pv-party-sub">'+custSub+'</div></div>'+
      '</div>'+
      '<table class="pv-tbl"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Taxable</th>'+taxCols+'</tr></thead><tbody>'+itemRows+'</tbody></table>'+
      '<div class="pv-foot"><div class="pv-words">'+esc(moneyWords(t.grand,t.cur))+'</div><table class="pv-sums"><tbody>'+sumRows+'</tbody></table></div>'+
      decl+notesHtml+bankHtml+
      '<div class="pv-sign"><b>For '+esc(val("s_name")||"Your Business")+'</b>Authorised Signatory</div>'+
      '<div class="pv-watermark">Generated free at invoice2gst.com</div>';
  }

  // ---- PDF ----
  function genPDF(){
    $("ig-err").textContent="";
    if(!val("s_name")){$("ig-err").textContent="Enter your business name first.";return;}
    if(!val("c_name")){$("ig-err").textContent="Enter the customer name.";return;}
    var t=recalc(); if(!t.items.length||t.taxable<=0){$("ig-err").textContent="Add at least one item with an amount.";return;}
    var J=window.jspdf&&window.jspdf.jsPDF;
    if(!J){$("ig-err").textContent="PDF library loading — try again in a moment.";return;}
    var doc=new J({unit:"pt",format:"a4"}),W=doc.internal.pageSize.getWidth(),M=40,y=46;
    var sym=t.cur==="USD"?"$":"\u20B9"; function m(n){return sym+(n||0).toFixed(2);}
    function sn(id){return doc.stateName?"":(stateName(id)||"");}
    var tc=THEMES.filter(function(x){return x.id===theme;})[0];
    var rgb=tc?hexRgb(tc.color):[91,75,224];
    if(logoData){try{doc.addImage(logoData,"PNG",M,y-18,56,56);}catch(e){}}
    doc.setFont("helvetica","bold");doc.setFontSize(16);doc.text("TAX INVOICE",W-M,y,{align:"right"});
    doc.setFontSize(8);doc.setTextColor(150);doc.text("Original for recipient",W-M,y+13,{align:"right"});y+=22;
    doc.setTextColor(20);doc.setFontSize(12);doc.text(val("s_name"),logoData?M+68:M,y);y+=14;
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(90);
    var lx=logoData?M+68:M;
    (val("s_addr")||"").split(/\n/).forEach(function(l){if(l.trim()){doc.text(l.trim(),lx,y);y+=11;}});
    if(val("s_gstin")){doc.text("GSTIN: "+val("s_gstin").toUpperCase(),lx,y);y+=11;}
    if(val("s_pan")){doc.text("PAN: "+val("s_pan").toUpperCase(),lx,y);y+=11;}
    if(val("s_state")){doc.text("State: "+val("s_state")+" — "+stateName(val("s_state")),lx,y);y+=11;}
    doc.setTextColor(20);
    var ry=46;
    function mr(k,v){if(!v)return;doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(150);doc.text(k,W-M-140,ry);doc.setTextColor(20);doc.setFont("helvetica","bold");doc.text(String(v),W-M,ry,{align:"right"});ry+=13;}
    mr("Invoice No:",val("i_num")||"");mr("Date:",(val("i_date")||"").split("-").reverse().join("-"));mr("Due:",(val("i_due")||"").split("-").reverse().join("-"));if(val("i_terms"))mr("Terms:",val("i_terms"));if(val("i_eway"))mr("E-Way:",val("i_eway"));
    y=Math.max(y,ry)+6;
    doc.setDrawColor.apply(doc,rgb);doc.setLineWidth(2.5);doc.line(M,y,W-M,y);y+=14;
    doc.setLineWidth(0.5);doc.setDrawColor(220);
    doc.setFont("helvetica","bold");doc.setFontSize(10);doc.text("Bill to",M,y);y+=13;
    doc.setFont("helvetica","normal");doc.text(val("c_name"),M,y);y+=12;doc.setFontSize(9);doc.setTextColor(90);
    (val("c_addr")||"").split(/\n/).forEach(function(l){if(l.trim()){doc.text(l.trim(),M,y);y+=11;}});
    if(val("c_gstin")){doc.text("GSTIN: "+val("c_gstin").toUpperCase(),M,y);y+=11;}
    if(val("c_pos")){doc.text("Place of supply: "+val("c_pos")+" — "+stateName(val("c_pos")),M,y);y+=11;}
    doc.setTextColor(20);y+=6;
    var head,body;
    if(t.lut||t.rcm){head=[["#","Description","Qty","Rate","Taxable","Tax"]];body=t.items.map(function(l,i){return [i+1,l.desc+(l.hsn?" ("+l.hsn+")":""),l.qty+" "+l.unit,l.rate.toFixed(2),l.taxable.toFixed(2),"0.00"];});}
    else if(t.inter){head=[["#","Description","Qty","Rate","Taxable","IGST%","IGST"]];body=t.items.map(function(l,i){var tx=l.taxable*l.gst/100;return [i+1,l.desc+(l.hsn?" ("+l.hsn+")":""),l.qty+" "+l.unit,l.rate.toFixed(2),l.taxable.toFixed(2),l.gst+"%",tx.toFixed(2)];});}
    else{head=[["#","Description","Qty","Rate","Taxable","CGST","SGST"]];body=t.items.map(function(l,i){var tx=l.taxable*l.gst/100;return [i+1,l.desc+(l.hsn?" ("+l.hsn+")":""),l.qty+" "+l.unit,l.rate.toFixed(2),l.taxable.toFixed(2),(tx/2).toFixed(2),(tx/2).toFixed(2)];});}
    doc.autoTable({startY:y,head:head,body:body,margin:{left:M,right:M},styles:{fontSize:8,cellPadding:3.5},headStyles:{fillColor:rgb,textColor:255,fontSize:8},columnStyles:{0:{cellWidth:18}}});
    var ty=doc.lastAutoTable.finalY+14;
    function tl(l,v,big){doc.setFont("helvetica",big?"bold":"normal");doc.setFontSize(big?11:9.5);doc.setTextColor(big?20:90);doc.text(l,W-M-160,ty);doc.setTextColor(20);doc.text(v,W-M,ty,{align:"right"});ty+=big?18:13;}
    tl("Taxable value",m(t.taxable));
    if(!t.lut&&!t.rcm){if(t.inter)tl("IGST",m(t.igst));else{tl("CGST",m(t.cgst));tl("SGST",m(t.sgst));}}
    if(Math.abs(t.ro)>=0.005)tl("Round off",(t.ro<0?"- ":"")+m(Math.abs(t.ro)));
    tl("Total",m(t.grand),true);
    var by=ty+8;doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(90);
    doc.text("Amount in words: "+moneyWords(t.grand,t.cur),M,by,{maxWidth:W-2*M});by+=18;
    if(t.lut){doc.setFontSize(8);doc.text((preset.note||"Supply meant for export under LUT/Bond without payment of IGST (Rule 96A).")+(val("i_lutno")?" LUT/ARN: "+val("i_lutno"):""),M,by,{maxWidth:W-2*M});by+=16;}
    if(t.rcm){doc.setFontSize(8);doc.text(preset.note||"GST payable by recipient under Reverse Charge (RCM).",M,by,{maxWidth:W-2*M});by+=16;}
    if(val("i_notes")){doc.setFontSize(9);doc.text("Notes: "+val("i_notes"),M,by,{maxWidth:W-2*M});by+=14;}
    if(val("i_terms2")){doc.setFontSize(9);doc.text("Terms: "+val("i_terms2"),M,by,{maxWidth:W-2*M});by+=14;}
    if(val("s_bank")||val("s_ifsc")){doc.setFontSize(8.5);doc.text("Bank: "+val("s_bank")+(val("s_ifsc")?" · IFSC: "+val("s_ifsc"):""),M,by);by+=14;}
    doc.setTextColor(20);doc.setFont("helvetica","bold");doc.setFontSize(9.5);doc.text("For "+val("s_name"),W-M,by+22,{align:"right"});
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text("Authorised Signatory",W-M,by+40,{align:"right"});
    doc.setFontSize(7.5);doc.setTextColor(180);doc.text("Generated free at invoice2gst.com",M,doc.internal.pageSize.getHeight()-22);
    doc.save(("Invoice_"+(val("i_num")||"draft")).replace(/[^\w\-]+/g,"_")+".pdf");
    // advance counter
    var nx=parseInt(val("s_next")||"1",10)+1;
    if($("s_next"))$("s_next").value=nx;
    saveBiz();refreshInvNum();
  }

  function hexRgb(hex){hex=hex.replace("#","");return[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];}

  // ---- persistence ----
  var BKEY="i2g_biz_v2";
  function saveBiz(){
    try{localStorage.setItem(BKEY,JSON.stringify({name:val("s_name"),gstin:val("s_gstin"),pan:val("s_pan"),addr:val("s_addr"),state:val("s_state"),email:val("s_email"),phone:val("s_phone"),bank:val("s_bank"),ifsc:val("s_ifsc"),prefix:val("s_prefix"),next:val("s_next"),logo:logoData||""}));
    $("bizOk").innerHTML='<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M5 13l4 4L19 7" stroke="#0d9d6c" stroke-width="2" stroke-linecap="round"/></svg> Saved';
    setTimeout(function(){$("bizOk").innerHTML="";},2000);}catch(e){}
  }
  function loadBiz(){
    try{var b=JSON.parse(localStorage.getItem(BKEY)||"null");if(!b)return;
    $("s_name").value=b.name||"";$("s_gstin").value=b.gstin||"";$("s_pan").value=b.pan||"";
    $("s_addr").value=b.addr||"";if(b.state)$("s_state").value=b.state;
    $("s_email").value=b.email||"";$("s_phone").value=b.phone||"";
    $("s_bank").value=b.bank||"";$("s_ifsc").value=b.ifsc||"";
    $("s_prefix").value=b.prefix||"INV-";$("s_next").value=b.next||"1";
    if(b.logo){logoData=b.logo;}
    }catch(e){}
  }
  function refreshInvNum(){if($("i_num"))$("i_num").value=(val("s_prefix")||"")+(val("s_next")||"1");}

  // ---- theme picker ----
  function buildThemePicker(container){
    var wrap=document.createElement("div"); wrap.className="ig-themes";
    wrap.innerHTML='<span>Color theme:</span>';
    THEMES.forEach(function(th){
      var d=document.createElement("div"); d.className="theme-dot"+(th.id===theme?" on":"");
      d.style.background=th.color; d.title=th.label;
      d.onclick=function(){
        theme=th.id;
        document.querySelectorAll(".theme-dot").forEach(function(x){x.classList.remove("on");});
        d.classList.add("on");
        var paper=$("ig-paper"); if(paper){paper.className="ig-a4 theme-"+theme;paper.style.setProperty("--tc",th.color);}
        recalc();
      };
      wrap.appendChild(d);
    });
    container.appendChild(wrap);
  }

  // ---- apply preset ----
  function applyPreset(){
    if(preset.currency&&$("i_cur")) $("i_cur").value=preset.currency;
    if(preset.lut){$("i_lut").checked=true;$("lut_wrap").style.display="";}
    if(preset.rcm) $("i_rcm").checked=true;
    if(preset.eway) $("eway_wrap").style.display="";
    if(preset.items) preset.items.forEach(function(it){addItemRow({desc:it.desc,sac:it.sac,gst:it.gst,unit:preset.unit});});
    else addItemRow({desc:preset.item||"",sac:preset.sac||"",gst:preset.rate,unit:preset.unit});
  }

  // ---- bind events ----
  function bindEvents(){
    $("saveBiz").onclick=saveBiz;
    $("addItem").onclick=function(){addItemRow({});};
    $("dlPdf").onclick=genPDF;
    if($("tDl")) $("tDl").onclick=genPDF;
    $("prn").onclick=function(){window.print();};
    if($("tPrn")) $("tPrn").onclick=function(){window.print();};
    $("c_shipdiff").onchange=function(){$("c_shipwrap").style.display=this.checked?"":"none";recalc();};
    $("i_lut").onchange=function(){$("lut_wrap").style.display=this.checked?"":"none";if(this.checked)$("i_rcm").checked=false;recalc();};
    $("i_rcm").onchange=function(){if(this.checked){$("i_lut").checked=false;$("lut_wrap").style.display="none";}recalc();};
    ["s_prefix","s_next"].forEach(function(id){var e=$(id);if(e)e.addEventListener("input",refreshInvNum);});
    $("s_logo").onchange=function(){var f=this.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){logoData=rd.result;recalc();};rd.readAsDataURL(f);};
    document.querySelectorAll("#ig-form-col .up").forEach(function(el){el.addEventListener("input",function(){this.value=this.value.toUpperCase();});});
    var watch=["s_name","s_gstin","s_pan","s_addr","s_state","s_email","s_phone","c_name","c_gstin","c_pos","c_addr","c_ship","i_num","i_date","i_due","i_terms","i_terms2","i_lutno","i_eway","i_cur","i_notes","i_discpct","i_discamt"];
    watch.forEach(function(id){var e=$(id);if(e)e.addEventListener("input",recalc);});
    fillSel($("s_state"),STATES,"06"); fillSel($("c_pos"),STATES,"06");
    $("i_date").value=new Date().toISOString().slice(0,10);
    refreshInvNum();
  }

  // ---- mount ----
  function mount(){
    var root=document.getElementById("ig-app"); if(!root)return;
    PK=root.getAttribute("data-preset")||"generic";
    preset=PRESETS[PK]||PRESETS.generic;
    // find or create the hero area to inject theme picker
    var hero=document.querySelector(".ig-hero");
    if(hero) buildThemePicker(hero);
    // build layout inside #ig-app
    root.innerHTML='<div class="ig-main"><div class="ig-form" id="ig-form-col"></div><div class="ig-preview-col" id="ig-prev-col"></div></div>';
    buildUI($("ig-form-col"));
    buildPreview($("ig-prev-col"));
    loadBiz();
    bindEvents();
    applyPreset();
    recalc();
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
  window.IG={PRESETS:PRESETS,THEMES:THEMES,STATES:STATES,recalc:recalc};
})();
