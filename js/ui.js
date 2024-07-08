import {VideoElementsAppender} from "/js/VideoElementsAppender.js"
import {testUsers, BASE_URL} from "/js/consts.js";
import * as utils from "/js/Utils.js";
import {
    onUserWantConnect,
    onMakeConference,
    onChangeSelectRoom,
    onWebcamComboChanged,
    storageInfo,
    onAnswer,
    onUserHangup,
    onUserCall,
    onToggleCamera,

    currentRoom,
    currentUserId,
    roomId,
    ifServerAliveThen,
    loginWithToken,
    actualServerURL,
    isCurrentMatrixConnectionActive, getUserName, getUser, onMessageInput
} from "/js/matrix-conference.js";
import {backgroundColors, EventType, MessageType} from "/js/Enums.js"
import {getRandomInt, getRandomString} from "/js/Utils.js";

let videoElementClassName = "video-element"

let userIdCombo = null
let userIdfield = null
let userNameLabel = null
let userNameSpan = null
let webcamComboLabel = null
let connectBtn = null
let webcamCombo = null;
let roomsBlock = null
let roomsComboBox= null
let roomsComboBoxLabel= null
let roomsMembersLabel= null
let roomMembersContainer= null
let videoContainer = null
let makeConfBtn = null
let toggleCameraBtn = null
let infoContainer = null
let userPreference = null
let serverField = null
let hideBtn = null
let messageList = null
let messageInputField = null
let messageContainer = null
let clientContent = null
let controlsContainer = null
let userPass = null

export let videoElementsAppender = null

let initElementsVars = () => new Promise((resolve, reject) => {

    userIdCombo = document.getElementById("userIdCombo")
    webcamComboLabel = document.getElementById("webcamComboLabel")
    roomsComboBox = document.getElementById("roomsComboBox");
    roomsComboBoxLabel = document.getElementById("roomsComboBoxLabel");
    connectBtn = document.getElementById("connectBtn")
    webcamCombo = document.getElementById("webcamCombo")
    videoContainer = document.getElementById("videoBackground")
    makeConfBtn = document.getElementById("make-conference-btn")
    toggleCameraBtn = document.getElementById("toggle-camera-btn")
    infoContainer = document.getElementById("notesContainer")
    roomsBlock = document.getElementById("roomsBlock")
    userPreference = document.getElementById("userPreference")
    userNameLabel = document.getElementById("userNameLabel")
    userNameSpan = document.getElementById("userName")
    serverField = document.getElementById("server-field")
    userIdfield = document.getElementById("userId-field")
    messageList = document.getElementById("messageList")
    hideBtn = document.getElementById("hidebtn")
    roomMembersContainer = document.getElementById("roomMembersContainer")
    roomsMembersLabel = document.getElementById("roomsMembersLabel")
    messageInputField = document.getElementById("messageInputField")
    messageContainer = document.getElementById("messageContainer")
    clientContent = document.getElementById("clientContent")
    controlsContainer = document.getElementById("controls")
    userPass = document.getElementById("user-pass")

    videoElementsAppender = new VideoElementsAppender(videoContainer, videoElementClassName);

    serverField.value = BASE_URL
    userNameLabel.innerHTML = 'Пользователь:&nbsp;'
    roomsComboBoxLabel.innerText = "Комната"
    roomsMembersLabel.innerText = "Члены:"
    hideBtn.innerHTML = "Expand &#x25BC;"
    showNote("You can enjoin matrix video conference with this example. Make sure to edit the constants in consts.js first.")
    startBackgroundGradient()
    resolve()
})

HTMLSelectElement.prototype.addComboOption = function (value, caption) {
    let option = document.createElement("option");
    option.value = value;
    option.text = caption;
    this.appendChild(option)
}

window.onload = (e) => {
    initElementsVars()
        .then(() => ifServerAliveThen())
        .then(function (versionsResponse) {
            showNote(`Server ${actualServerURL} available with version ${versionsResponse.versions[versionsResponse.versions.length - 1]}`)
            storageInfo.load()

            //fill users
            userIdCombo.innerHTML = "";
            userIdCombo.addComboOption("", "")
            Object.keys(testUsers).forEach(login => {
                userIdCombo.addComboOption(testUsers[login], login)
            })

            setIsCanConnect(userIdCombo.childNodes.length < 1)

            showNote("Press connect to start connecting.")
            disableButtons(true, true, true);

            connectBtn.onclick = onUserWantConnect

            makeConfBtn.onclick = onMakeConference

            roomsComboBox.onchange = onChangeSelectRoom

            webcamCombo.onchange = onWebcamComboChanged

            userIdCombo.onchange = onUserComboChanged

            userNameSpan.addEventListener('click', toggleUserPreference)

            hideBtn.addEventListener('click', onHideBtn)

            messageInputField.addEventListener('keypress', onMessageInput)

            toggleCameraBtn.onclick = onToggleCamera

            accessCamera(async () => {

                //fill webcams
                webcamCombo.innerHTML = "";
                webcamCombo.style.display = "";
                webcamComboLabel.style.display = "";

                let defaultDevice1 = null;
                let defaultDevice2 = null;
                let isStorageInfoDeviceExists = false;

                (await navigator.mediaDevices.enumerateDevices())
                    .filter(d => d.deviceId)
                    .forEach(d => {
                        isStorageInfoDeviceExists = isStorageInfoDeviceExists || storageInfo.deviceId === d.deviceId

                        if (storageInfo.deviceId === d.deviceId || defaultDevice1 == null && utils.isCameraOrWebcamName(d.label))
                            defaultDevice1 = d.deviceId
                        if (defaultDevice2 == null && d.label.toLowerCase().search("cam") >= 0)
                            defaultDevice2 = d.deviceId

                        webcamCombo.addComboOption(d.deviceId, d.label)
                    })

                if (isStorageInfoDeviceExists) {
                    webcamCombo.value = defaultDevice1
                } else
                    webcamCombo.value = defaultDevice1 || defaultDevice2

                onWebcamComboChanged()

                if (isStorageInfoDeviceExists && storageInfo.token) {
                    loginWithToken(storageInfo.token)
                }
            })
        })
        .catch(error => showError(error.message))
}

export function accessCamera(func) {
    let f = function(a,v) {
        navigator.mediaDevices.getUserMedia({video: v, audio: a})
            .then(function (stream) {
                // Получили доступ к камере, теперь можно использовать поток (stream)
                //const videoElement = document.createElement('video');
                //videoElement.srcObject = stream;
                //document.body.appendChild(videoElement);
                func()
            })
            .catch(function (error) {
                console.error('Ошибка при запросе доступа к камере: ', error.message);
            });
    }
    try { f(false, true) } catch (e) {}
    //try { f(true, false) } catch (e) {}
}

let onUserComboChanged = (e) => {
    userIdfield.value = e.target.value;
}

export async function getIfDeviceExist(id) {
    if(!!id === false) return null
    let devices = await navigator.mediaDevices.enumerateDevices();
    devices = devices.filter(d => d.deviceId === id)
    return devices.length > 0 ? devices[devices.length - 1] : null
}

export function setIsCanConnect(isDisabled) {
    connectBtn.disabled = isDisabled
    userIdfield.disabled = isDisabled
    userIdCombo.disabled = isDisabled
    serverField.disabled = isDisabled
}

export let setIsCanSelectWebCam = (isDisabled) => {
    webcamCombo.disabled = isDisabled
}

export let selectedWebCam = () => webcamCombo.value

export let selectedUserId = () => {
    let r = userIdfield.value
    if(r == null || /^@\w+:[\w\\.]+$|^\w+$/.test(r) === false ) {
        showError("Incorrect userId")
        return null
    }
    return r
}

export let selectedRoomId = () => roomsComboBox.value

export function showError(desc, message) {
    let p = document.createElement("p")
    p.textContent = `${utils.getCurrentTimeString()}: ${desc}${message || ""}`
    p.style.color = "red"
    infoContainer.prepend(p)
}

export function showNote(info) {
    showError(info)
    infoContainer.firstChild.style.color = ""
}

export function disableButtons(place, answer, hangup) {
    if(place)
        document.getElementById("call").disabled = place;
    if(hangup)
        document.getElementById("hangup").disabled = hangup;
    if(answer)
        document.getElementById("answer").disabled = answer;
}

export function toggleMakeConfBtn(isDisabled) {
    makeConfBtn.disabled = isDisabled
}

export function fToggleCameraBtn(isDisabled) {
    toggleCameraBtn.disabled = isDisabled
}

export function addRoomForSelection(roomId, name) {
    if(Array.from(roomsComboBox.options).filter(o=>o.value===roomId).length !== 0 || !!roomId===false && roomId!=="") return

    roomsComboBox.addComboOption(roomId, name)
}

export function setSelectedRoom(roomId) {
    roomsComboBox.value = roomId
}

export let showInfo = function () {
    let roomName = currentRoom.name

    document.getElementById("config").innerHTML =
        "<p>" +
        "Homeserver: <code>" +
        actualServerURL +
        "</code><br/>" +
        "Room: <code>" + roomName + " ("+roomId + ")"+"</code><br/>" +
        //"groupCall: " + (groupCall === null ?  "not " : "") + " exist" + "<br/>" +
        "UserId: <code>" +
        currentUserId +
        "</code><br/>" +
        "</p>";
};

export function enableClientContentDisplaying() {
    clientContent.style.display = ""
}

export function disableClientContentDisplaying() {
    clientContent.style.display = "none"
}

Node.prototype.disableChildrens = function (isDisabled) {
    Array.from(this.childNodes).forEach(node => {
            if (node.tagName === "DIV")
                node.disableChildrens(isDisabled)
            else
                node.disabled = isDisabled
        }
    )
}

Node.prototype.setDisplayDisabled = function (isDisabled) {
    this.style.display = isDisabled ? "none" : ""
}

export function toggleCurrentRoomUi(isDisabled) {
    controlsContainer.disableChildrens(isDisabled)
    Array.from(messageContainer.childNodes).forEach(node=> {  if (node.tagName === "DIV") node.setDisplayDisabled(isDisabled)})

    roomMembersContainer.setDisplayDisabled(isDisabled)
    roomsMembersLabel.setDisplayDisabled(isDisabled)
    if(isDisabled) {
        clearMessageList()
        roomMembersContainer.removeAllChildrens()
        roomsComboBox.value = ""
    }
}

export function selectAnyRoom() {
    let nodes = Array.from(roomsComboBox.childNodes).filter(o=>o.value)
    if(nodes.length < 1) return
    roomsComboBox.value = nodes[getRandomInt(0, nodes.length)%nodes.length].value
    onChangeSelectRoom()
}

export function clearRoomsInSelection() {
    roomsComboBox.removeAllChildrens()
}

export let addCalControlListeners = () => {
    document.getElementById("call").onclick = onUserCall

    document.getElementById("hangup").onclick = onUserHangup

    document.getElementById("answer").onclick = onAnswer
}

export let selectOtherRoom = (roomId) => {
    if(roomsComboBox == null) return
    let other = Array.from(roomsComboBox.options).filter(o=>o.value!==roomId)
    if(other.length === 0) return

    roomsComboBox.value = other[0].roomId
    onChangeSelectRoom()
}

Node.prototype.toggleDisplay = function() {
    if(this.style)
        this.style.display = this.style.display  ? "" : "none"
};

let onHideBtn = () => {
    hideBtn.innerHTML = hideBtn.innerHTML.charCodeAt(hideBtn.innerHTML.length - 1).toHexString() === "25BC" ? "Hide &#x25B2;" : "Expand &#x25BC;"
    toggleUserPreference()
}

export let toggleUserPreference = () => {
    userPreference.childNodes.forEach(node=> {
        if(node === hideBtn) return
        node.toggleDisplay()
    })

    if(isCurrentMatrixConnectionActive()) {
        if (currentUserId) {
            userIdfield.value = currentUserId

            if (Object.values(testUsers).indexOf(currentUserId) >= 0)
                userIdCombo.value = currentUserId
        }

        if (actualServerURL) {
            serverField.value = actualServerURL
        }
    }
}

export let setLoginButtonText = (text) => {
    connectBtn.innerHTML = text
}

export let setUserName = (username) => {
    userNameSpan.textContent = username
}

export let getServerFieldValue = () => {
    return serverField.value.replace(/\/+$/, "")
}

Node.prototype.removeAllChildrens = function() {
    let i = this.childNodes.length + 1;
    while(this.hasChildNodes() && i > 0) { i--; this.removeChild(this.firstChild)}
};

let bornMemberDiv = (name, isOnline) => {
    // Create the container div
    const containerDiv = document.createElement('div');
    containerDiv.className = "h"

    // Create the text node
    const textNode =  document.createElement('div')
    textNode.className = "roomMemberTextNode"
    textNode.innerText = name
    containerDiv.appendChild(textNode);

    // Create the circle div
    const circleDiv = document.createElement('div');
    circleDiv.className = "roomMemberCircleDiv"
    circleDiv.classList.add(isOnline ? 'greenBackground':'redBackground')

    // Append the circle div to the container
    containerDiv.appendChild(circleDiv);

    // Append the container div to the body or another element in the DOM
    return containerDiv
}

export let updateRoomMembersContainer = () => {
    roomMembersContainer.removeAllChildrens()

    if(currentRoom == null) return

    Object.keys(currentRoom.currentState.members).forEach(userId=>{
        let m = currentRoom.currentState.members[userId]
        let user = m.user == null ? getUser(m.userId) : m.user

        roomMembersContainer.appendChild(
            bornMemberDiv(
                m.name,
                m.membership === 'join' && user && user.presence === 'online'
            )
        )
    })
}

export let clearMessageList = () => messageList.removeAllChildrens()

export let addMessageToList = (e) => {
    let eventDate = (new Date(e.localTimestamp))
    e = e.event
    let isTheyMessage = e.sender !== currentUserId

    //add new day if necessary
    let lastMessageAuthor = messageList && messageList.lastChild && messageList.lastChild.querySelector("div[id*=author]")
    let newDay = null
    if(lastMessageAuthor && lastMessageAuthor.eventDate && lastMessageAuthor.eventDate.getDay() !== eventDate.getDay()) {
      newDay = bornDiv({className1:"newDay", textContent:eventDate.toLocaleString('ru-RU', {
              month: "long",
              day: "numeric",
              year: lastMessageAuthor.eventDate.getFullYear() !== eventDate.getFullYear() ? "numeric" : undefined
          })})
    }

    let addItem = (item) => {
        if(newDay) messageList.appendChild(newDay)
        messageList.appendChild(item)
    }

    const messageContent = bornDiv({
        className1: "v",
        className2: !isTheyMessage ?  "messageContentWe" : "messageContentThey"
    })

    const messageBody = bornDiv({className1:"h", className2:"messageBody", parent: messageContent})

    const author = bornDiv({
        className1: "messageAuthor",
        textContent:`${getUserName(e.sender)}: `,
        id: `author-${getRandomString(5)}`,
        parent: messageBody
    })

    author.eventDate = eventDate
    //convert to format string
    eventDate = eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    if(e.type === EventType.MESSAGE) {

        const messageText = bornDiv({className1:"messageText", textContent:e.content.body, parent:messageBody})

        const messageTime = bornDiv({className1: "messageTime", textContent:eventDate,  parent:messageContent})

        addItem(messageContent)

        if(isTheyMessage && messageBody.offsetWidth && messageBody.offsetWidth > 3) {
            messageTime.style.marginLeft = `${Math.floor(0.8 * messageBody.offsetWidth)}px`;
        }
    }
}

function bornDiv(options) {
    const newDiv = document.createElement('div');

    if(options.id)
        newDiv.id = options.id

    if(options.className1)
        newDiv.classList.add(options.className1)
    if(options.className2)
        newDiv.classList.add(options.className2)

    if(options.parent)
        options.parent.appendChild(newDiv)

    if(options.textContent)
        newDiv.textContent = options.textContent

    return newDiv
}

Number.prototype.toHexString = function () {
    let h = "0123456789abcdef"; let r = "";
    let p = this;  while(p > 0) {  r = `${h[p % 16]}${r}`; p -= p % 16;  p/=16 }
    return r.toUpperCase();
}

function componentToHex(c) {
    let hex = c.toHexString();
    return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function startBackgroundGradient() {
    //return
    let randomIndex = getRandomInt(0, backgroundColors.length) % backgroundColors.length
    let colors = [backgroundColors[randomIndex][0], backgroundColors[randomIndex][1]]

    let workColorIndex = null
    let workColor = null
    let setWorkColor = () => {
        workColorIndex = getRandomInt(0, 2)%2
        workColor = ["r", "g", "b"][getRandomInt(0,3)%3]
    }
    setWorkColor()
    let i = 0
    let delta = 1

    setInterval(() => {
        if(i%2 === 0 &&
            (delta > 0 && colors[workColorIndex][workColor] < 255 ||
                delta < 0 && colors[workColorIndex][workColor] > 120)) {

            colors[workColorIndex][workColor] += delta

        } else if(colors[workColorIndex][workColor]>=255 && delta > 0 ||
            colors[workColorIndex][workColor] <= 120 && delta < 0 ||
            (i > 48 && getRandomInt(0,3) === 1)) {
            setWorkColor()
            if(colors[workColorIndex][workColor] > 250)
                delta = -1
            else
                delta = 1
            i = 0
        }

        i++
        let color1 = rgbToHex(  colors[0].r , colors[0].g, colors[0].b);
        let color2 = rgbToHex(  colors[1].r , colors[1].g, colors[1].b);

        document.getElementById('ourBody').style.background =
            `radial-gradient(ellipse at center, ${color1}, ${color2})`;
    }, 41.67); // Change every 1/24 second
}

export function getEnteredPass() {
    return userPass.value
}
