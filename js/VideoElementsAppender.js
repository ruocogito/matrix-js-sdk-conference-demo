import * as utils from "/js/Utils.js";

export class VideoElementsAppender {
  constructor(container, elementClassName, elmBackgroundColor, minimumSize, parentPadding, videoMargin) {
    this.container = container;
    this.minimumSize = minimumSize != null ? minimumSize : 150;
    this.parentPadding = parentPadding != null ? parentPadding : 15;
    this.videoMargin = videoMargin != null ? videoMargin : 10;
    this.elmBackgroundColor = elmBackgroundColor != null ? elmBackgroundColor : "green";
    this.elementClassName = elementClassName != null ? elementClassName : "videoElement";
    this.maxSidePx = 478;
  }

  placeVideElements = ()=>{

    let parentWidth = this.container.offsetWidth;

    let n = this.container.querySelectorAll(`video[class='${this.elementClassName}']`).length

    let space = parentWidth - (2*n)*this.videoMargin - this.parentPadding*2
    this.container.style.padding = `${this.parentPadding}px`
    if(space/n >= this.minimumSize) {
      let actualWidth = (space / n)%this.maxSidePx;
      let i = 0;
      this.container.querySelectorAll(`video[class='${this.elementClassName}']`).forEach(e=>{
        this.setElmStyle(e, actualWidth)
        e.style.order = `${i++}`;
      })
      this.container.style.display = "flex"
      this.container.style.flexDirection = "row"
    } else {
      this.container.style.display = "flex"
      this.container.style.flexDirection = "column"
      this.container.style.justifyContent = "flex-start"

      let rowN = Math.floor(space / this.minimumSize)
      let actualElmWidth = Math.floor(space / rowN)
      let childs = this.container.querySelectorAll(`video[class='${this.elementClassName}']`)
      let rowDiv = document.createElement("div")

      let appendRowDiv = () => {rowDiv.id = `rowDiv${i++}`; this.container.appendChild(rowDiv);rowDiv = document.createElement("div");}
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

  async bornVideoComponent(isLocal, userId, feed, isExistOponent)  {

    if(userId == null || feed == null || this.container==null) return null

    let elmId = await this.getVideoId(isLocal, userId);

    let oldElement = this.container.querySelector(`video#${elmId}`)
    console.log(`bornVideoComponent oldElement:${oldElement} isLocal:${isLocal} userId:${userId} ts:${Date.now()}`)
    if(oldElement != null) {
      return this.replaceVideoElementWithNewFeed(oldElement, feed, isExistOponent)
    }

    const videoElement = document.createElement('video');
    videoElement.id = elmId;
    videoElement.style.display = 'none'
    this.container.appendChild(videoElement);

    videoElement.className = this.elementClassName;

    videoElement.srcObject = feed.stream;
    videoElement.muted = isLocal;

    return videoElement.play().then(()=>{
      // Append the new video element to 'videoBackground'
      this.placeVideElements()
      videoElement.style.display = '';
      return videoElement
    })
  }

  replaceVideoElementWithNewFeed(element, feed, isExistOponent) {
    if(element == null) return null

    let newVideoElement = document.createElement('video');
    //newLocalElement.style.display = "none";
    if(typeof element.isExistOponent != 'undefined') {
      newVideoElement.muted = true;
      newVideoElement.isExistOponent = isExistOponent;
    }

    newVideoElement.srcObject = feed.stream;
    newVideoElement.className = element.className
    return newVideoElement.play().then(()=> {
      let lid = element.id
      element.id = null;
      newVideoElement.id = lid
      newVideoElement.style.cssText = element.style && element.style.cssText
      //newVideoElement.style.order = element.style.order
      element.parentNode.prepend(newVideoElement)
      //element.parentNode.replaceChildren(element, newVideoElement)
      element.remove()
      if(this.isVideoPlaying(element))
        element.pause()
    })
  }

  localVideoElementsCount() {
    return this.container.querySelectorAll('[id^="local-"]').length
  }

  getFirstLocalElement() {
    return this.container.querySelector('[id^="local-"]')
  }

  remoteVideoElementsCount() {
    return this.container.querySelectorAll('[id^="remote-"]').length
  }

  removeVideoElement(isLocal, userId) {
    if(isLocal==null || !!userId===false) return

    return this.getVideoId(isLocal, userId).then(videoId=>{
      let videoElement = document.getElementById(videoId);
      if (videoElement) {
        let removeFunc = ()=>{
          videoElement.srcObject = null; // Frees the stream after pausing
          let parent = videoElement.parentNode
          if(parent) {
            videoElement.parentNode.removeChild(videoElement);
            //if(remoteVideoElementsCount() === 0 && localVideoElementsCount() === 1)
            //    return removeVideoElement(true, client.getUserId())
          }
        };
        if(this.isVideoPlaying(videoElement)) {
          videoElement.pause()
          removeFunc()
        }
        else
          removeFunc()
      }
    })
  }

  setElmStyle(e, actualElmWidth) {
    e.style.width = `${actualElmWidth}px`
    e.style.height = `${actualElmWidth}px`
    e.style.backgroundColor = this.elmBackgroundColor
    e.style.margin = `${this.videoMargin}px`
  }

  isVideoPlaying(videoElement) {
    return !!(videoElement.currentTime > 0 && !videoElement.paused && !videoElement.ended && videoElement.readyState > 2);
  }

  getVideoId(isLocal, userId) {
    let prefix = isLocal ? 'local' : "remote"
    return utils.calculateHashSha256(userId)
        .then((idSuffix)=>{return `${prefix}-${idSuffix}`})
  }
}

