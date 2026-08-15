(function(){
  var nav=document.getElementById("nav");
  var dd=document.getElementById("dd"), ddbtn=document.getElementById("ddbtn"), hamb=document.getElementById("hamb");
  if(ddbtn&&dd){
    ddbtn.addEventListener("click",function(e){e.stopPropagation();dd.classList.toggle("open");});
    document.addEventListener("click",function(){dd.classList.remove("open");});
  }
  if(hamb&&nav){ hamb.addEventListener("click",function(){nav.classList.toggle("open");}); }
  var p=location.pathname.replace(/\/index\.html$/,"/");
  var links=document.querySelectorAll("#nav .menu>a, #nav .ddmenu a");
  Array.prototype.forEach.call(links,function(a){
    var h=(a.getAttribute("href")||"").split("?")[0];
    if(!h) return;
    if((h==="/"&&p==="/")||(h!=="/"&&p===h)) a.classList.add("active");
  });
})();
