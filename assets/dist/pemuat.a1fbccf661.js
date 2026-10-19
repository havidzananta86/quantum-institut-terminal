try{
(function(){var a=["Connecting to data feeds…","Loading market modules…","Preparing interface…"],e=document.getElementById("qiLoadStatus"),d=0,o=setInterval(function(){e&&d<a.length&&(e.textContent=a[d++])},600),i=!1;function n(){if(!i){i=!0,clearInterval(o),e&&(e.textContent="Ready");var t=document.getElementById("qiLoadScreen");t&&t.classList.add("done"),setTimeout(function(){t&&t.remove()},450)}}document.addEventListener("DOMContentLoaded",n),window.addEventListener("load",n),setTimeout(n,8e3)})();
}catch(e){setTimeout(function(){throw e})}
//# sourceMappingURL=pemuat.a1fbccf661.js.map
