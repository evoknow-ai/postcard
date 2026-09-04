const SLIDE_EDITOR_STATE_KEY="postcardEditorStateV1";
const SLIDE_RETURN_MARKER_KEY="postcardReturnToSlidesV1";

(async()=>{
  let returningToSlides=false;
  let slideDuration=3;

  try{
    const data=await chrome.storage.local.get([SLIDE_EDITOR_STATE_KEY,SLIDE_RETURN_MARKER_KEY]);
    const state=data?.[SLIDE_EDITOR_STATE_KEY];
    returningToSlides=!!data?.[SLIDE_RETURN_MARKER_KEY];

    if(returningToSlides&&state&&Array.isArray(state.slides)&&state.slides.length){
      const activeSlide=Math.max(0,Math.min(Number(state.activeSlide)||0,state.slides.length-1));
      const slide=state.slides[activeSlide];
      slideDuration=Number(slide.duration)||3;
      await chrome.storage.local.set({
        [SLIDE_EDITOR_STATE_KEY]:{
          ...state,
          bg:structuredClone(slide.bg||{}),
          blocks:structuredClone(slide.blocks||[]),
          tables:structuredClone(slide.tables||[]),
          currentFormat:slide.format||"landscape",
          activeSlide
        }
      });
    }
  }catch(error){
    console.error("Could not prepare slide for editing:",error);
  }

  const editorScript=document.createElement("script");
  editorScript.src="editor.js";
  editorScript.onload=()=>{
    const backButton=document.getElementById("backToSlidesBtn");
    if(!returningToSlides||!backButton)return;

    backButton.removeAttribute("hidden");
    document.querySelectorAll("#slideDuration").forEach(input=>input.value=slideDuration);
    document.querySelectorAll("#slideDurationValue").forEach(label=>label.textContent=`${slideDuration}s`);

    backButton.addEventListener("click",async event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        document.activeElement?.blur?.();
        saveActiveSlide();
        clearTimeout(saveTimer);
        await chrome.storage.local.set({[STATE_KEY]:currentEditorState()});
        await chrome.storage.local.remove(RETURN_TO_SLIDES_KEY);
        location.href="slides.html";
      }catch(error){
        console.error("Could not return to Slides:",error);
        setStatus("Could not save this slide. Please try again.");
      }
    },true);
  };
  document.body.appendChild(editorScript);
})();
