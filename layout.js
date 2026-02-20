document.addEventListener("DOMContentLoaded", () => {

const transition = document.createElement("div");
transition.id = "globalTransition";
document.body.appendChild(transition);

const style = document.createElement("style");
style.innerHTML = `
#globalTransition{
position:fixed;
top:0;
left:0;
width:100%;
height:100%;
background:linear-gradient(135deg,#00F5FF,#0099FF);
transform:translateY(100%);
z-index:9999;
}
`;
document.head.appendChild(style);

document.querySelectorAll("a").forEach(link=>{
if(link.hostname === window.location.hostname){
link.addEventListener("click",function(e){
e.preventDefault();
const href = this.href;
gsap.to("#globalTransition",{
y:0,
duration:0.7,
ease:"power2.inOut",
onComplete:()=>window.location.href = href
});
});
}
});

});
