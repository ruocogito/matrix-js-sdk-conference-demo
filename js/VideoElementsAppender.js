
class VideoElementsAppender {
  constructor(containerId, elementClassName, elmBackgroundColor, minimumSize, parentPadding, videoMargin) {
    this.containerId = containerId;
    this.minimumSize = minimumSize != null ? minimumSize : 150;
    this.parentPadding = parentPadding != null ? parentPadding : 15;
    this.videoMargin = videoMargin != null ? videoMargin : 10;
    this.elmBackgroundColor = elmBackgroundColor != null ? elmBackgroundColor : "green";
    this.elementClassName = elementClassName != null ? elementClassName : "videoElement";
    this.maxSidePx = 478;
    this.parent = document.getElementById(this.containerId)
  }

  placeVideElements = ()=>{

    let parentWidth = this.parent.offsetWidth;

    let n = this.parent.querySelectorAll(`video[class='${this.elementClassName}']`).length

    let space = parentWidth - (2*n)*this.videoMargin - this.parentPadding*2
    this.parent.style.padding = `${this.parentPadding}px`
    if(space/n >= this.minimumSize) {
      let actualWidth = (space / n)%this.maxSidePx;
      let i = 0;
      this.parent.querySelectorAll(`video[class='${this.elementClassName}']`).forEach(e=>{
        this.setElmStyle(e, actualWidth)
        e.style.order = `${i++}`;
      })
      this.parent.style.display = "flex"
      this.parent.style.flexDirection = "row"
    } else {
      this.parent.style.display = "flex"
      this.parent.style.flexDirection = "column"
      this.parent.style.justifyContent = "flex-start"

      let rowN = Math.floor(space / this.minimumSize)
      let actualElmWidth = Math.floor(space / rowN)
      let childs = this.parent.querySelectorAll(`video[class='${this.elementClassName}']`)
      let rowDiv = document.createElement("div")

      let appendRowDiv = () => {rowDiv.id = `rowDiv${i++}`; this.parent.appendChild(rowDiv);rowDiv = document.createElement("div");}
      document.querySelectorAll("div[id*=rowDiv]").forEach(e=>e.parentNode.removeChild(e))

      let i = 0;
      let j = 0;
      childs.forEach((e,videoIndex)=>{
        if(e.parentNode)
          e.parentNode.removeChild(e)

        if(rowDiv.childNodes.length === rowN) {
          appendRowDiv()
        }
        if(rowDiv.childNodes.length === 0) {
          rowDiv.style.display = "flex"
          rowDiv.style.flexDirection = "row"
          rowDiv.style.justifyContent = "space-around"
        }
        rowDiv.appendChild(e)
        this.setElmStyle(e, actualElmWidth)
        e.style.order = `${j++}`;

        if(videoIndex === n - 1)
          appendRowDiv()
      })

    }
  }

  setElmStyle(e, actualElmWidth) {
    e.style.width = `${actualElmWidth}px`
    e.style.height = `${actualElmWidth}px`
    e.style.backgroundColor = this.elmBackgroundColor
    e.style.margin = `${this.videoMargin}px`
  }
}

/*
let test = (n) => { fill(n); (new VideoElementsAppender('con')).placeVideElements(); }

let fill = (n) => {
  let parent = document.getElementById("con")
  parent.innerHTML= ""

  let j = 0;
  let countVideos =  n == null ? 1+Math.floor(Math.random() * 10) : n
  while(j++ < countVideos) {
    let vDiv = document.createElement("div")
    vDiv.className = "videoElement"
    parent.appendChild(vDiv)
  }
}
 */

