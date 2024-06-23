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

    currentRoom, currentUserId, roomId, ifServerAliveThen, loginWithToken
} from "/js/matrix-conference.js";

let videoElementClassName = "video-element"

let userIdCombo = null
let webcamComboLabel = null
let connectBtn = null
let webcamCombo = null;
let roomsComboBox= null
let roomsComboBoxLabel= null
let videoContainer = null
let makeConfBtn = null
let infoContainer = null

export let videoElementsAppender = null

window.onload = () => {
   return (()=> {
        userIdCombo = document.getElementById("userIdCombo")
        webcamComboLabel = document.getElementById("webcamComboLabel")
        roomsComboBox = document.getElementById("roomsComboBox");
        roomsComboBoxLabel = document.getElementById("roomsComboBoxLabel");
        connectBtn = document.getElementById("connectBtn")
        webcamCombo = document.getElementById("webcamCombo")
        videoContainer = document.getElementById("videoBackground")
        makeConfBtn = document.getElementById("make-conference-btn")
        infoContainer = document.getElementById("notesContainer")

        videoElementsAppender = new VideoElementsAppender(videoContainer, videoElementClassName);
        return ifServerAliveThen()
    })()
        .then(function (versionsResponse) {
    showNote(`Server ${BASE_URL} available with version ${versionsResponse.versions[versionsResponse.versions.length - 1]}`)
    storageInfo.load()

    //fill users
    userIdCombo.innerHTML = "";
    Object.keys(testUsers).forEach(login=>{
        let option = document.createElement("option");
        option.value = testUsers[login];
        option.text = login;
        userIdCombo.appendChild(option);
    })

    setIsCanConnect(userIdCombo.childNodes.length < 1)

    showNote("Press connect to start connecting.")
    disableButtons(true, true, true);

    connectBtn.onclick = onUserWantConnect

    makeConfBtn.onclick = onMakeConference

    roomsComboBox.onchange = onChangeSelectRoom

    webcamCombo.onchange = onWebcamComboChanged

    accessCamera(async () => {

        //fill webcams
        webcamCombo.innerHTML = "";
        webcamCombo.style.display = "";
        webcamComboLabel.style.display = "";

        let defaultDevice1 = null;
        let defaultDevice2 = null;
        let isStorageInfoDeviceExists = false;

        (await navigator.mediaDevices.enumerateDevices())
            .filter(d=>d.deviceId)
            .forEach(d=> {
                isStorageInfoDeviceExists = isStorageInfoDeviceExists || storageInfo.deviceId === d.deviceId

                if(storageInfo.deviceId === d.deviceId || defaultDevice1 == null && utils.isCameraOrWebcamName(d.label))
                    defaultDevice1 = d.deviceId
                if(defaultDevice2 == null && d.label.toLowerCase().search("cam")>=0)
                    defaultDevice2 = d.deviceId

                connectBtn.disabled = false
                let option = document.createElement("option");
                option.value = d.deviceId;
                option.text = d.label;
                webcamCombo.appendChild(option);
            })

        if(isStorageInfoDeviceExists) {
            webcamCombo.value = defaultDevice1
        }
        else
            webcamCombo.value = defaultDevice1 || defaultDevice2

        onWebcamComboChanged()

        if(isStorageInfoDeviceExists && storageInfo.token) {
            loginWithToken(storageInfo.token)
        }
    })
})
    .catch(error => showError(error.message)) }

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

export async function getIfDeviceExist(id) {
    if(!!id === false) return null
    let devices = await navigator.mediaDevices.enumerateDevices();
    devices = devices.filter(d => d.deviceId === id)
    return devices.length > 0 ? devices[devices.length - 1] : null
}

export function setIsCanConnect(isDisabled) {
    connectBtn.disabled = isDisabled
}

export let setIsCanSelectWebCam = (isDisabled) => {
    webcamCombo.disabled = isDisabled
}

export let selectedWebCam = () => webcamCombo.value

export let selectedUserId = () => userIdCombo.value

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
    document.getElementById("hangup").disabled = hangup;
    document.getElementById("answer").disabled = answer;
    document.getElementById("call").disabled = place;
}

export function addRoomForSelection(roomId, name) {
    if(Array.from(roomsComboBox.options).filter(o=>o.value===roomId).length !== 0 || !!roomId===false) return

    let option = document.createElement("option");
    option.value = roomId;
    option.text = name;
    roomsComboBox.appendChild(option);
}

export function setSelectedRoom(roomId) {
    roomsComboBox.value = roomId
}

export let showInfo = function () {
    let roomName = currentRoom.name

    document.getElementById("config").innerHTML =
        "<p>" +
        "Homeserver: <code>" +
        BASE_URL +
        "</code><br/>" +
        "Room: <code>" + roomName + " ("+roomId + ")"+"</code><br/>" +
        //"groupCall: " + (groupCall === null ?  "not " : "") + " exist" + "<br/>" +
        "UserId: <code>" +
        currentUserId +
        "</code><br/>" +
        "</p>";

    connectBtn.innerHTML = "Connected"
};

export function enableRoomSelectionDisplaying() {
    roomsComboBox.style.display = ""
    roomsComboBoxLabel.style.display = ""
}

export function clearRoomsInSelection() {
    roomsComboBox.innerHTML = "";
}

export let addCalControlListeners = () => {
    document.getElementById("toggle_camera").onclick = onToggleCamera

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