
(async function () {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYQE74B4BMygaBx3XZVm_Gm1S0jEvhvP3zgz0ZB4szrhLQoBCR_uk9OAsLvoroh4hXTw/exec";

  function simulateHover(el){el?.dispatchEvent(new MouseEvent("mouseenter",{bubbles:true}));}
  function simulateMouseLeave(el){el?.dispatchEvent(new MouseEvent("mouseleave",{bubbles:true}));}

  async function getClosestPopoverValue(rect,fallback){return new Promise((res)=>{let t=0,i=setInterval(()=>{let p=document.querySelectorAll(".n-popover__content");if(p.length>0){let c=null,m=1/0;p.forEach(e=>{let r=e.getBoundingClientRect(),d=Math.hypot(rect.left-r.left,rect.top-r.top);if(d<m){m=d,c=e}});clearInterval(i);res(c?.textContent.trim()||fallback)}if(++t>=10){clearInterval(i);res(fallback)}},100)})}

  function convertToDate(d,m){let [mo,y]=m.split(" "),n=new Date(`${mo} 1, ${y}`).getMonth()+1;return `${y}-${n.toString().padStart(2,"0")}-${d.padStart(2,"0")}`;}

  function extractBusinessName(){return document.querySelector(".hl_switcher-loc-name")?.textContent.trim()||"Not Found";}
  function extractLocationID(){let m=window.location.href.match(/\/location\/([^\/]+)/);return m?m[1]:"Not Found";}

  function extractDateRange(){
    let s=document.querySelector(".n-date-panel-date--selected.n-date-panel-date--start"),
        e=document.querySelector(".n-date-panel-date--selected.n-date-panel-date--end"),
        c=document.querySelectorAll(".n-date-panel-calendar"),
        m=document.querySelectorAll(".n-date-panel-month__text");
    if(!s||!e||c.length<2||m.length<2) return "Not Found";
    let ms=s.closest(".n-date-panel-calendar")===c[0]?m[0].textContent.trim():m[1].textContent.trim(),
        me=e.closest(".n-date-panel-calendar")===c[0]?m[0].textContent.trim():m[1].textContent.trim();
    return `${convertToDate(s.textContent.trim(),ms)} - ${convertToDate(e.textContent.trim(),me)}`;
  }

  async function extractValue(label,isSpend=false){
    let cards=document.querySelectorAll(".hl-card");
    for(let card of cards){
      let h=card.querySelector(".hl-card-header")?.innerText.trim();
      if(!h||!h.includes(label)) continue;

      let v;
      if(isSpend&&["Google Ads Report","Facebook Ads Report"].includes(label)){
        let b=card.querySelectorAll(".hl-card-content .flex.flex-col.gap-1");
        for(let blk of b){
          let sl=blk.querySelector(".text-gray-500")?.innerText.trim();
          if(sl?.includes("Total Spent")){v=blk.querySelector(".text-3xl, text, svg text");break;}
        }
      } else {
        v=card.querySelector(".hl-card-content .text-3xl, .hl-card-content text, .hl-card-content svg text");
      }

      if(v){
        let p=v.textContent.trim(),r=v.getBoundingClientRect();
        simulateHover(v);
        await new Promise(x=>setTimeout(x,300));
        let val=await getClosestPopoverValue(r,p);
        simulateMouseLeave(v);
        await new Promise(x=>setTimeout(x,250));
        return val!=="Not Found"?val:p;
      }
    }
    console.warn(`❌ Value for ${label} not found.`);
    return "Not Found";
  }

  async function sendToWebhook(d){
    try {
      let q=new URLSearchParams(d).toString(),
          r=await fetch(APPS_SCRIPT_URL+"?"+q),
          t=await r.text();
      console.log("📡 Webhook Response:",t);
    } catch(e) {
      console.error("❌ Error:",e);
    }
  }

  async function extractData(){
    let labels=[
      ["Google Ads Report",true],["Google Total Scheduled + Completed"],["Total Google Leads"],["Google Leads Scheduled + Completed"],
      ["Facebook Ads Report",true],["Facebook Total Scheduled + Completed"],["Total Facebook Leads"],["Facebook Leads Scheduled + Completed"],
      ["Facebook/Google Total Scheduled + Completed"],["Total Facebook/Google Leads"],["Facebook/Google Leads Scheduled + Completed"]
    ];

    let map={
      "Google Ads Report":"Google Ads Report Total Spent",
      "Google Total Scheduled + Completed":"Google Total Scheduled + Completed",
      "Total Google Leads":"Total Google Leads",
      "Google Leads Scheduled + Completed":"Google Leads Scheduled + Completed",
      "Facebook Ads Report":"Facebook Ads Report Total Spent",
      "Facebook Total Scheduled + Completed":"Facebook Total Scheduled + Completed",
      "Total Facebook Leads":"Total Facebook Leads",
      "Facebook Leads Scheduled + Completed":"Facebook Leads Scheduled + Completed",
      "Facebook/Google Total Scheduled + Completed":"Facebook/Google Total Scheduled + Completed",
      "Total Facebook/Google Leads":"Total Facebook/Google Leads",
      "Facebook/Google Leads Scheduled + Completed":"Facebook/Google Leads Scheduled + Completed"
    };

    let d={
      "Business Name":extractBusinessName(),
      "Location ID":extractLocationID(),
      "Date Range":extractDateRange()
    };

    for(let [label, isSpend=false] of labels){
      let v=await extractValue(label,isSpend);
      d[map[label]]=v;
      console.log(`➡️ ${map[label]}:`,v);
    }

    console.table(d);
    await sendToWebhook(d);
  }

  const dp=document.querySelector(".n-date-picker .n-input");
  dp?.click();
  await new Promise(r=>setTimeout(r,500));
  console.log("📅 Extracted Date Range:", extractDateRange());
  await extractData();
})();
