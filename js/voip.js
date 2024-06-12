const BASE_URL = "https://devmatrix.linkpc.net";
const USER_ID = "devmatrix.linkpc.net";
let roomId;
let groupCall;
let call;
let client = null;

let GroupCallIntent = {
    Ring: "m.ring",
    Prompt: "m.prompt",
    Room: "m.room",
}

let CallEvent = {
    Hangup : "hangup",
    State : "state",
    Error : "error",
    Replaced : "replaced",

    // The value of isLocalOnHold() has changed
    LocalHoldUnhold : "local_hold_unhold",
    // The value of isRemoteOnHold() has changed
    RemoteHoldUnhold : "remote_hold_unhold",
    // backwards compat alias for LocalHoldUnhold: remove in a major version bump
    HoldUnhold : "hold_unhold",
    // Feeds have changed
    FeedsChanged : "feeds_changed",

    AssertedIdentityChanged : "asserted_identity_changed",

    LengthChanged : "length_changed",

    DataChannel : "datachannel",

    SendVoipEvent : "send_voip_event",

    // When the call instantiates its peer connection
    // For apps that want to access the underlying peer connection, eg for debugging
    PeerConnectionCreated : "peer_connection_created",
}

let GroupCallEvent = {
    GroupCallStateChanged : "group_call_state_changed",
    ActiveSpeakerChanged : "active_speaker_changed",
    CallsChanged : "calls_changed",
    UserMediaFeedsChanged : "user_media_feeds_changed",
    ScreenshareFeedsChanged : "screenshare_feeds_changed",
    LocalScreenshareStateChanged : "local_screenshare_state_changed",
    LocalMuteStateChanged : "local_mute_state_changed",
    ParticipantsChanged : "participants_changed",
    Error : "group_call_error",
}

function accessCamera(func) {
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

async function getDeviceId() {
    let devices = await navigator.mediaDevices.enumerateDevices();
    devices = devices.filter(d => d.deviceId && (d.label.includes("Webcam") || d.label.includes("Virtual Camera") || d.label.includes("VCam")))
    return devices.length > 0 ? devices[devices.length - 1] : null
}

function makeConnect(username) {
    matrixcs
        .createClient({baseUrl: BASE_URL})
        .loginWithPassword(username, "1")
        .then(async (accessDat) => {
            console.log("login success with access token:" + accessDat.access_token);
            accessCamera(async () => {
                let device = await getDeviceId()
                console.log("get access to device \"" + device.label + "\" with id:" + device.deviceId)
                // Reinitialize client with access token.
                //

                client = matrixcs.createClient({
                    baseUrl: BASE_URL,
                    accessToken: accessDat.access_token,
                    userId: "@" + username + ":" + USER_ID,
                    deviceId: device.deviceId,
                    useE2eForGroupCall: false
                })

                //Olm.init({locateFile: () => './js/node_modules/@matrix-org/olm/olm.wasm'}).then((x)=>{

                   // client.initCrypto().then(() => {
                    //console.log('Olm initialized for encryption.');

                    startClient()
                //})})

            });
        });
}

function disableButtons(place, answer, hangup) {
    document.getElementById("hangup").disabled = hangup;
    document.getElementById("answer").disabled = answer;
    document.getElementById("call").disabled = place;
}

let lastOnFeedsChanged = -Infinity;
let onFeedsChanged = function (feeds) {

    if(Date.now() - lastOnFeedsChanged < 250) {
        (async ()=>{
            await sleep(getRandomInt(300, 500));
            onFeedsChanged(feeds)
        })();
        return
    }
    lastOnFeedsChanged = Date.now()

    const localFeed = feeds.find((feed) => feed.isLocal());
    const remoteFeed = feeds.find((feed) => !feed.isLocal());

    console.log(`onFeedsChanged: isLocal:${(!!localFeed)}, size:${feeds.length}` )

    if (remoteFeed) {
        bornVideoComponent(false, remoteFeed.userId).then((remoteElement)=>{
            remoteElement.srcObject = remoteFeed.stream;
            remoteElement.play();
            console.log("Remote stream: "+remoteFeed.stream)
        })
    }
    if (localFeed && localVideoElementsCount() < 1) {
        bornVideoComponent(true, client.getUserId()).then((localElement)=>{
            localElement.muted = true;
            localElement.srcObject = localFeed.stream;
            localElement.play();
        })
    }
}

function isVideoPlaying(videoElement) {
    return !!(videoElement.currentTime > 0 && !videoElement.paused && !videoElement.ended && videoElement.readyState > 2);
}

function getVideoId(isLocal, userId) {
    let prefix = isLocal ? 'local' : "remote"
    return calculateHashSha256(userId)
        .then((idSuffix)=>{return `${prefix}-${idSuffix}`})
}

async function bornVideoComponent(isLocal, userId)  {
    const videoElement = document.createElement('video');
    videoElement.className = 'video-element';
    videoElement.id = await getVideoId(isLocal, userId);

    // Find the element with the ID 'videoBackground'
    const videoBackground = document.getElementById('videoBackground');

    // Append the new video element to 'videoBackground'
    videoBackground.appendChild(videoElement);

    return videoElement;
}

function localVideoElementsCount() {
    return document.getElementById('videoBackground').querySelectorAll('[id^="local-"]').length
}

function removeVideoElement(isLocal, userId) {
    if(!!isLocal===false || !!userId===false) return

    return getVideoId(isLocal, userId).then(videoId=>{
        let videoElement = document.getElementById(videoId);
        if (videoElement) {
            let removeFunc = ()=>{
                videoElement.srcObject = null; // Frees the stream after pausing
                let parent = videoElement.parentNode
                if(parent) {
                    videoElement.parentNode.removeChild(videoElement);
                    if(parent.children.length === 1 && localVideoElementsCount() === 1)
                        return removeVideoElement(true, client.getUserId())
                }
            };
            if(isVideoPlaying(videoElement))
                videoElement.pause().then(() => {
                    removeFunc()
                });
            else
                removeFunc()
        }
    })
}

function addListeners(call) {
    let lastError = "";
    call.on(CallEvent.Hangup, function () {

        let remoteUserId = call.getOpponentMember() ? call.getOpponentMember().userId : null
        removeVideoElement(false, remoteUserId)

        disableButtons(false, true, true);
        document.getElementById("result").innerHTML = "<p>Call ended. Last error: " + lastError + "</p>";
    });
    call.on(CallEvent.Error, function (err) {
        lastError = err.message;
        call.hangup();
        disableButtons(false, true, true);
    });
    call.on(CallEvent.FeedsChanged, onFeedsChanged);
}

function addGroupListeners(call) {
    call.on(GroupCallEvent.ParticipantsChanged, function (p) {
        console.log("participants_changed: " + inspect(p))
    });

    call.on(GroupCallEvent.UserMediaFeedsChanged, function (f) {
        console.log("user_media_feeds_changed:, size: " + f.length)//+ inspect(f)
        onFeedsChanged(f)
    });

    call.on(GroupCallEvent.CallsChanged, function (p) {
        console.log("calls_changed: " + inspect(p))
    });

    call.on(GroupCallEvent.Error, function (e) {
        console.log("group_call_error: " + inspect(e))
    });

    call.on(CallEvent.State, function (e) {
        console.log("CallEvent.State: " + inspect(e))
    });

    call.on(CallEvent.SendVoipEvent, function (e) {
        console.log("CallEvent.SendVoipEvent: " + inspect(e))
    });

    call.on(GroupCallEvent.Error, function (e) {
        console.log("group_call_error: " + inspect(e))
    });

    call.on(CallEvent.FeedsChanged, function (f) {
        console.log("feeds_changed, size: " + f.length)
        onFeedsChanged(f)
    });

}

window.onload = function () {
    document.getElementById("result").innerHTML = "<p>Press connect to start connecting.</p>";
    disableButtons(true, true, true);

    document.getElementById("connect").onclick = function () {
        document.getElementById('username').value && makeConnect(document.getElementById('username').value)
        document.getElementById("result").innerHTML = "<p>Please wait. Syncing...</p>";
    };
}

let showInfo = function () {
    let roomName = client.getRoom(roomId).name

    document.getElementById("config").innerHTML =
        "<p>" +
        "Homeserver: <code>" +
        BASE_URL +
        "</code><br/>" +
        "Room: <code>" + roomName + " ("+roomId + ")"+"</code><br/>" +
        "groupCall: " + (groupCall === null ?  "not " : "") + " exist" + "<br/>" +
        "UserId: <code>" +
        client.getUserId() +
        "</code><br/>" +
        "</p>";

    document.getElementById("connect").innerHTML = "Connected"

};

function startClient() {
    client.on("sync", function (state, prevState, data) {
        switch (state) {
            case "PREPARED":
                syncComplete();
                break;
        }
    })
    //client.initCrypto().then((x)=>{client.startClient();})
    client.startClient();
}

function syncComplete() {

    client.on("RoomMember.membership", function (event, member) {
        let isOurUser = member.userId === client.getUserId()
        let isJoin = member.membership === "join"
       // if(member.membership !== "leave" && !isJoin || !member.roomId) return
        if (member.membership === "invite" && isOurUser) {
            client.joinRoom(member.roomId).then(function () {
                console.log("Auto-joined %s", member.roomId);
            });
        }

       // oncorlineMatrix.updateRoomServerEvent(member.roomId, isOurUser, isJoin)
        //if(isJoin) {
        //
        // }
        // else
        // isOurUser && oncorlineMatrix.dialogWrapper.serverLeaveRoomEvent();
        //  oncorlineMatrix.updateRoomServerEvent(member.roomId, isOurUser, isJoin)

    });


    client.getJoinedRooms().then((obj) => {
        let comboBox = document.getElementById("myComboBox");
        comboBox.style.display = ""
        document.getElementById("myComboBoxLabel").style.display = ""
        // Clear existing options
        comboBox.innerHTML = "";

        obj.joined_rooms.forEach(roomId1 => {

            let option = document.createElement("option");
            option.value = roomId1;
            option.text = client.getRoom(roomId1).name;
            comboBox.appendChild(option);
        })
        obj && obj.joined_rooms.length > 0 && comboBoxChanged();
    });

    let rooms = client.getRooms();
    rooms.forEach(room => {
        //console.log(room.roomId);
    });

    document.getElementById("result").innerHTML = "<p>Ready for calls.</p>";
    disableButtons(false, true, true);

    document.getElementById("toggle_camera").onclick = function () {
        call.getLocalFeeds().find((feed) => feed.isLocal()).stream.getVideoTracks().map(x => x.enabled = !x.enabled)
    }

    document.getElementById("call").onclick = function () {
        console.log("Placing call...");
        let options = {}
        if(groupCall)
            options.groupCallId = groupCall.groupCallId
        call = matrixcs.createNewMatrixCall(client, roomId, options);
        console.log("Call => %s", call);
        addListeners(call);
        call.placeVideoCall();
        document.getElementById("result").innerHTML = "<p>Placed call.</p>";
        disableButtons(true, true, false);
    };

    document.getElementById("hangup").onclick = function () {

        if(call) {
            console.log("Hanging up call...");
            console.log("Call => %s", call);
            call.hangup();
        }

        if(groupCall && groupCall.state === 'entered') {
            console.log("Hanging up groupCall...");
            console.log("groupCall => %s", call);
            groupCall.leave();
            disableButtons(false, true, true);
        }

        document.getElementById("result").innerHTML = "<p>Hungup call.</p>";
    };

    document.getElementById("answer").onclick = function () {
        console.log("Answering call...");
        console.log("Call => %s", call);
        call.answer();
        disableButtons(true, true, false);
        document.getElementById("result").innerHTML = "<p>Answered call.</p>";
    };

    document.getElementById("remove_group_call").onclick = async function () {
        if(groupCall === null) return;
        groupCall.leave()
        await sleep(300)
        groupCall.dispose()
        await sleep(300)
        groupCall.terminate();
        await sleep(300)
        groupCall = client.getGroupCallForRoom(roomId);
        showInfo();
    };

    client.on("Call.incoming", function (c) {
        console.log("Call ringing");
        disableButtons(true, false, false);
        document.getElementById("result").innerHTML = "<p>Incoming call...</p>";
        call = c;
        addListeners(call);
    });

    client.on("User.presence", (u,b)=>{
        //console.log("User.presence: u"+ inspect(u))
        //console.log("User.presence: b"+ inspect(b))
    })

    client.on("User.currentlyActive", (u,b)=>{
        //console.log("User.currentlyActive: u ") //+ inspect(u)
        console.log("User.currentlyActive: b " + b && b.userId ? b.userId : "" ) //inspect(b)
    })

    client.on("GroupCall.incoming", (c)=>{
        console.log("GroupCall.incoming")
        disableButtons(true, false, false);
        document.getElementById("result").innerHTML = "<p>Incoming groupCall call...</p>";
        groupCall = c
        addGroupListeners(c);
    });

    client.on("GroupCall.outgoing", (c)=>{
        console.log("GroupCall.outgoing")
        disableButtons(true, false, false);
        document.getElementById("result").innerHTML = "<p>Outgoing groupCall call...</p>";
        groupCall = c
        addGroupListeners(c);
    });

    client.on("GroupCall.participants", (x,y,z)=>{
        console.log("GroupCall.participants")
    });

    client.on("received_voip_event", (x,y,z)=>{
        console.log(`received_voip_event: ${x} ${y} ${z}`)
    });

    client.on("toDeviceEvent", (x,y,z)=>{
        console.log(`toDeviceEvent: ${x} ${y} ${z}`)
    });
}

function comboBoxChanged() {
    let comboBox = document.getElementById("myComboBox");
    let selectedRoomId = comboBox.value;

    //console.log("Selected room ID:", selectedRoomId);

    roomId = selectedRoomId;
    groupCall = client.getGroupCallForRoom(roomId);
    disableButtons(!!groupCall===true, true, true);

    showInfo();
}

window.comboBoxChanged = comboBoxChanged

window.onJoinGroupCall = async function () {
    if(groupCall === null && roomId) {
        createGroupCall(roomId)
        await sleep(300);
        //groupCall = client.getGroupCallForRoom(roomId)
    }
    if(groupCall === null) return
    //groupCall.addListener("feeds_changed", onFeedsChanged);
    //addGroupListeners(groupCall);

    groupCall.initLocalCallFeed().then(async (x)=>{
           await sleep(300);
            groupCall.enter().then(x=>{
                console.log("enter then called")
                disableButtons(true, true, false);
                showInfo()
            })
    });

    //await sleep(500);

    //let remoteUserId = "@user1:"+USER_ID

    // @ts-ignore
    //const call = groupCall.calls.get(remoteUserId)
    /*call.getOpponentMember = () => ({ userId: call.invitee })
    // @ts-ignore Mock
    call.pushRemoteFeed(
        // @ts-ignore Mock
        new MockMediaStream("stream", [
            new MockMediaStreamTrack("audio_track", "audio"),
            new MockMediaStreamTrack("video_track", "video"),
        ]),
    );
    call.onSDPStreamMetadataChangedReceived(metadataEvent);*/
    //onFeedsChanged(groupCall.getLocalFeeds());
}

async function sleep(ms) {
    return (new Promise(resolve => setTimeout(resolve, ms)));
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

let calculateHashSha256 = function (string) {
    const utf8 = new TextEncoder().encode(string);
    let cr = typeof crypto === "undefined" || !!(crypto) === false ? crypto2 : crypto
    return cr.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((bytes) => bytes.toString(16).padStart(2, '0'))
            .join('');
        return hashHex;
    });
}

function createGroupCall(rId) {
    if(groupCall === null && rId) {
        let options = {}
        //call = matrixcs.createNewMatrixCall(client, roomId, options);
        //console.log("Call => %s", call);
        //addListeners(call);

        client.waitUntilRoomReadyForGroupCalls(x=>{
            client.createGroupCall(
                rId,
                "m.video",
                false,
                GroupCallIntent.Room,
                true,
                { //https://web.dev/articles/webrtc-datachannels
                    maxPacketLifeTime: null,//3000,
                    maxRetransmits: null,
                    ordered: false,
                    protocol: "udp"
                }
            ).then(g => {
                if (g) {
                    groupCall = g;
                    document.getElementById("result").innerHTML = "<p>Placed group call.</p>";
                    disableButtons(true, true, false);
                }
            });
        });
    }
}