/* GSTInvoice2GSTR1 - core classification & GSTR-1 sheet building.
   Works in the browser (window.G2G) and in node (module.exports). */
(function (root) {
  "use strict";

  var B2CL_THRESHOLD = 100000; // Rs 1,00,000 - rule from 01-Nov-2024

  function stateCode(s) {
    if (!s) return null;
    var m = String(s).match(/^\s*(\d{2})/);
    return m ? m[1] : null;
  }
  function validGstin(g) { return !!g && String(g).trim().length === 15; }
  function num(x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; }

  function invoiceTotals(inv) {
    var t = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
    (inv.line_items || []).forEach(function (li) {
      t.taxable += num(li.taxable_value);
      t.igst += num(li.igst); t.cgst += num(li.cgst);
      t.sgst += num(li.sgst); t.cess += num(li.cess);
    });
    return t;
  }

  function classify(inv) {
    var dt = (inv.document_type || "invoice").toLowerCase();
    if (dt.indexOf("credit") >= 0) return "Credit Notes";
    if (dt.indexOf("debit") >= 0) return "Debit Notes";
    if (inv.is_export) return "Exports";
    if (validGstin(inv.customer_gstin)) return "B2B";
    var sc = stateCode(inv.supplier_gstin), pos = stateCode(inv.place_of_supply);
    var interstate = sc && pos && sc !== pos;
    if (interstate && num(inv.invoice_value) > B2CL_THRESHOLD) return "B2CL";
    return "B2CS";
  }

  // returns { "Sheet Name": [ [header...], [row...], ... ] }
  function buildSheets(invoices) {
    var buckets = { "B2B": [], "B2CL": [], "B2CS": [], "Exports": [], "Credit Notes": [], "Debit Notes": [] };
    var classified = [];
    invoices.forEach(function (inv) {
      var b = classify(inv); buckets[b].push(inv); classified.push([inv, b]);
    });

    var sheets = {};

    // Read me
    var now = new Date();
    sheets["Read me"] = [
      ["GSTR-1 Working - prepared by GSTInvoice2GSTR1"],
      [""],
      ["Generated", now.toLocaleString("en-IN")],
      ["Invoices read", invoices.length],
      [""],
      ["IMPORTANT - review before filing:"],
      ["  - Spot-check invoices against the source PDFs."],
      ["  - Confirm Place of Supply, GST rate and customer GSTIN on each."],
      ["  - B2CL threshold used: invoice value above Rs 1,00,000 (rule from 01-Nov-2024)."],
      ["  - The registered person remains responsible for the return."]
    ];

    // B2B
    var rows = [["Customer GSTIN", "Customer Name", "Invoice No", "Invoice Date", "Place of Supply", "Invoice Value", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]];
    buckets["B2B"].forEach(function (inv) {
      var t = invoiceTotals(inv);
      rows.push([inv.customer_gstin, inv.customer_name, inv.invoice_number, inv.invoice_date, inv.place_of_supply, num(inv.invoice_value), t.taxable, t.igst, t.cgst, t.sgst, t.cess]);
    });
    sheets["B2B (Table 4)"] = rows;

    // B2CL
    rows = [["Invoice No", "Invoice Date", "Place of Supply", "Invoice Value", "Taxable Value", "IGST", "Cess"]];
    buckets["B2CL"].forEach(function (inv) {
      var t = invoiceTotals(inv);
      rows.push([inv.invoice_number, inv.invoice_date, inv.place_of_supply, num(inv.invoice_value), t.taxable, t.igst, t.cess]);
    });
    sheets["B2CL (Table 5)"] = rows;

    // B2CS (rate-wise by POS)
    var g = {};
    buckets["B2CS"].forEach(function (inv) {
      (inv.line_items || []).forEach(function (li) {
        var key = (inv.place_of_supply || "") + "|" + num(li.gst_rate);
        var o = g[key] || (g[key] = { pos: inv.place_of_supply, rate: num(li.gst_rate), taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
        o.taxable += num(li.taxable_value); o.igst += num(li.igst); o.cgst += num(li.cgst); o.sgst += num(li.sgst); o.cess += num(li.cess);
      });
    });
    rows = [["Type", "Place of Supply", "Rate", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]];
    Object.keys(g).forEach(function (k) { var o = g[k]; rows.push(["OE", o.pos, o.rate, o.taxable, o.igst, o.cgst, o.sgst, o.cess]); });
    sheets["B2CS (Table 7)"] = rows;

    // Exports
    rows = [["Invoice No", "Invoice Date", "Invoice Value", "Taxable Value", "IGST", "(fill Port Code / Shipping Bill / Date)"]];
    buckets["Exports"].forEach(function (inv) {
      var t = invoiceTotals(inv);
      rows.push([inv.invoice_number, inv.invoice_date, num(inv.invoice_value), t.taxable, t.igst, ""]);
    });
    sheets["Exports (Table 6A)"] = rows;

    // Credit / Debit notes
    [["Credit Notes", "Credit Notes (9B)"], ["Debit Notes", "Debit Notes (9B)"]].forEach(function (pair) {
      rows = [["Note No", "Date", "Customer GSTIN", "Place of Supply", "Note Value", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]];
      buckets[pair[0]].forEach(function (inv) {
        var t = invoiceTotals(inv);
        rows.push([inv.invoice_number, inv.invoice_date, inv.customer_gstin, inv.place_of_supply, num(inv.invoice_value), t.taxable, t.igst, t.cgst, t.sgst, t.cess]);
      });
      sheets[pair[1]] = rows;
    });

    // HSN summaries
    var hb = {}, hc = {};
    classified.forEach(function (pair) {
      var inv = pair[0]; var target = validGstin(inv.customer_gstin) ? hb : hc;
      (inv.line_items || []).forEach(function (li) {
        var key = (li.hsn_sac || "") + "|" + num(li.gst_rate);
        var o = target[key] || (target[key] = { hsn: li.hsn_sac || "", desc: li.description || "", uqc: li.uqc || "", qty: 0, taxable: 0, rate: num(li.gst_rate), igst: 0, cgst: 0, sgst: 0, cess: 0 });
        o.qty += num(li.quantity); o.taxable += num(li.taxable_value); o.igst += num(li.igst); o.cgst += num(li.cgst); o.sgst += num(li.sgst); o.cess += num(li.cess);
      });
    });
    [[hb, "HSN Summary B2B (12A)"], [hc, "HSN Summary B2C (12B)"]].forEach(function (pair) {
      rows = [["HSN/SAC", "Description", "UQC", "Quantity", "Taxable Value", "Rate", "IGST", "CGST", "SGST", "Cess"]];
      Object.keys(pair[0]).forEach(function (k) { var o = pair[0][k]; rows.push([o.hsn, o.desc, o.uqc, o.qty, o.taxable, o.rate, o.igst, o.cgst, o.sgst, o.cess]); });
      sheets[pair[1]] = rows;
    });

    // Document summary
    var docs = {}; var label = { invoice: "Invoices for outward supply", credit_note: "Credit Note", debit_note: "Debit Note" };
    invoices.forEach(function (inv) {
      var dt = (inv.document_type || "invoice").toLowerCase();
      dt = dt.indexOf("credit") >= 0 ? "credit_note" : dt.indexOf("debit") >= 0 ? "debit_note" : "invoice";
      (docs[dt] || (docs[dt] = [])).push(String(inv.invoice_number || ""));
    });
    rows = [["Nature of Document", "Sr No From", "Sr No To", "Total Number", "Cancelled"]];
    Object.keys(docs).forEach(function (dt) {
      var nums = docs[dt].filter(Boolean).sort();
      rows.push([label[dt], nums[0] || "", nums[nums.length - 1] || "", docs[dt].length, 0]);
    });
    sheets["Document Summary (13)"] = rows;

    return sheets;
  }

  // ---------- Tally import XML (Sales / Credit Note / Debit Note vouchers) ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function stateName(pos) { // "29-Karnataka" -> "Karnataka"
    if (!pos) return "";
    var p = String(pos).split("-"); return (p.length > 1 ? p.slice(1).join("-") : p[0]).trim();
  }
  function tallyDate(d) { // "14-05-2026" -> "20260514"
    var m = String(d || "").match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (!m) { var t = new Date(); return "" + t.getFullYear() + ("0" + (t.getMonth() + 1)).slice(-2) + ("0" + t.getDate()).slice(-2); }
    var yy = m[3].length === 2 ? "20" + m[3] : m[3];
    return yy + ("0" + m[2]).slice(-2) + ("0" + m[1]).slice(-2);
  }
  function fx(n) { return (Number(n) || 0).toFixed(2); }

  function buildTallyXML(invoices) {
    // collect unique parties for ledger masters
    var parties = {};
    invoices.forEach(function (inv) {
      var name = inv.customer_name || inv.customer_gstin || "Unregistered Customer";
      if (!parties[name]) parties[name] = { gstin: inv.customer_gstin || "", state: stateName(inv.place_of_supply) };
    });

    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push("<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>");
    out.push("<REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA>");

    // ---- ledger masters (convenience; Tally merges by name) ----
    Object.keys(parties).forEach(function (name) {
      var p = parties[name];
      var reg = p.gstin && p.gstin.length === 15 ? "Regular" : "Unregistered";
      out.push('<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="' + esc(name) + '" ACTION="Create">');
      out.push("<NAME>" + esc(name) + "</NAME><PARENT>Sundry Debtors</PARENT>");
      out.push("<ISBILLWISEON>Yes</ISBILLWISEON><GSTREGISTRATIONTYPE>" + reg + "</GSTREGISTRATIONTYPE>");
      if (p.gstin) out.push("<PARTYGSTIN>" + esc(p.gstin) + "</PARTYGSTIN><GSTIN>" + esc(p.gstin) + "</GSTIN>");
      if (p.state) out.push("<LEDSTATENAME>" + esc(p.state) + "</LEDSTATENAME>");
      out.push("</LEDGER></TALLYMESSAGE>");
    });
    [["Sales", "Sales Accounts", ""], ["Output IGST", "Duties & Taxes", "Integrated Tax"],
     ["Output CGST", "Duties & Taxes", "Central Tax"], ["Output SGST", "Duties & Taxes", "State Tax"],
     ["Output Cess", "Duties & Taxes", "Cess"]].forEach(function (l) {
      out.push('<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="' + esc(l[0]) + '" ACTION="Create"><NAME>' + esc(l[0]) + "</NAME><PARENT>" + esc(l[1]) + "</PARENT>");
      if (l[2]) out.push("<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>" + esc(l[2]) + "</GSTDUTYHEAD>");
      out.push("</LEDGER></TALLYMESSAGE>");
    });

    // ---- vouchers ----
    invoices.forEach(function (inv) {
      var t = invoiceTotals(inv);
      var total = t.taxable + t.igst + t.cgst + t.sgst + t.cess;
      var dt = (inv.document_type || "invoice").toLowerCase();
      var vch = dt.indexOf("credit") >= 0 ? "Credit Note" : dt.indexOf("debit") >= 0 ? "Debit Note" : "Sales";
      var credit = vch === "Credit Note";
      var party = inv.customer_name || inv.customer_gstin || "Unregistered Customer";

      function entry(name, amount, deemedPos) {
        return "<ALLLEDGERENTRIES.LIST><LEDGERNAME>" + esc(name) + "</LEDGERNAME>" +
          "<ISDEEMEDPOSITIVE>" + deemedPos + "</ISDEEMEDPOSITIVE><AMOUNT>" + fx(amount) + "</AMOUNT></ALLLEDGERENTRIES.LIST>";
      }
      var entries = [];
      if (!credit) {
        entries.push(entry(party, -total, "Yes"));
        entries.push(entry("Sales", t.taxable, "No"));
        if (t.igst) entries.push(entry("Output IGST", t.igst, "No"));
        if (t.cgst) entries.push(entry("Output CGST", t.cgst, "No"));
        if (t.sgst) entries.push(entry("Output SGST", t.sgst, "No"));
        if (t.cess) entries.push(entry("Output Cess", t.cess, "No"));
      } else {
        entries.push(entry(party, total, "No"));
        entries.push(entry("Sales", -t.taxable, "Yes"));
        if (t.igst) entries.push(entry("Output IGST", -t.igst, "Yes"));
        if (t.cgst) entries.push(entry("Output CGST", -t.cgst, "Yes"));
        if (t.sgst) entries.push(entry("Output SGST", -t.sgst, "Yes"));
        if (t.cess) entries.push(entry("Output Cess", -t.cess, "Yes"));
      }

      out.push('<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="' + esc(vch) + '" ACTION="Create" OBJVIEW="Invoice Voucher View">');
      out.push("<DATE>" + tallyDate(inv.invoice_date) + "</DATE><VOUCHERTYPENAME>" + esc(vch) + "</VOUCHERTYPENAME>");
      out.push("<VOUCHERNUMBER>" + esc(inv.invoice_number) + "</VOUCHERNUMBER>");
      out.push("<PARTYLEDGERNAME>" + esc(party) + "</PARTYLEDGERNAME><PARTYNAME>" + esc(party) + "</PARTYNAME>");
      if (stateName(inv.place_of_supply)) out.push("<PLACEOFSUPPLY>" + esc(stateName(inv.place_of_supply)) + "</PLACEOFSUPPLY><STATENAME>" + esc(stateName(inv.place_of_supply)) + "</STATENAME>");
      if (inv.customer_gstin) out.push("<PARTYGSTIN>" + esc(inv.customer_gstin) + "</PARTYGSTIN>");
      out.push(entries.join(""));
      out.push("</VOUCHER></TALLYMESSAGE>");
    });

    out.push("</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>");
    return out.join("");
  }

  var api = { classify: classify, invoiceTotals: invoiceTotals, buildSheets: buildSheets, buildTallyXML: buildTallyXML };
  root.G2G = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : global);
