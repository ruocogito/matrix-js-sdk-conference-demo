let roomId;
let groupCall;
let call;
let client = null;
let conferenceCalls = {}
let deviceId = null
let webcamComboLabel = null
let connectBtn = null
let currentRoom = null;
let currentUserIdHash = null

let videoElementClassName = "video-element"
let videoContainerId = "videoBackground"
let roomsComboBox= null

let CallErrorCode = {
    UserHangup : "user_hangup",
    InviteTimeout : "invite_timeout"
    //other not included
}

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

async function getDevice(id) {
    let devices = await navigator.mediaDevices.enumerateDevices();
    devices = devices.filter(d => d.deviceId === id)
    return devices.length > 0 ? devices[devices.length - 1] : null
}

function makeConnect(userId) {
    matrixcs
        .createClient({baseUrl: BASE_URL})
        .loginWithPassword(userId, testPass)
        .then(async (accessDat) => {
            console.log("login success with access token:" + accessDat.access_token);
            accessCamera(async () => {

                let device = await getDevice(document.getElementById("webcamCombo").value)
                console.log("get access to device \"" + device.label + "\" with id:" + device.deviceId)
                // Reinitialize client with access token.
                //

                client = matrixcs.createClient({
                    baseUrl: BASE_URL,
                    accessToken: accessDat.access_token,
                    userId: userId,
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

    bornVideoComponent(false, remoteFeed && remoteFeed.userId, remoteFeed, null)
        .then((remoteElement)=>{
        if(remoteElement) console.log("Remote stream: "+remoteFeed.stream)
    })
        .catch(e=>console.log(`Error during bornVideoComponent: ${e.message}`)).then(()=>{
        if (localVideoElementsCount() < 1 || remoteFeed) {
            bornVideoComponent(true, client.getUserId(), localFeed, remoteFeed != null).then((localElement)=>{
                if(localElement) console.log("Local stream: "+remoteFeed.stream)
            }).catch(e=>console.log(`Error during bornVideoComponent: ${e.message}`))
        }
    })
}

function isVideoPlaying(videoElement) {
    return !!(videoElement.currentTime > 0 && !videoElement.paused && !videoElement.ended && videoElement.readyState > 2);
}

function getVideoId(isLocal, userId) {
    let prefix = isLocal ? 'local' : "remote"
    return calculateHashSha256(userId)
        .then((idSuffix)=>{return `${prefix}-${idSuffix}`})
}

async function bornVideoComponent(isLocal, userId, feed, isExistOponent)  {
    const videoBackground = document.getElementById(videoContainerId);
    if(userId == null || feed == null || videoBackground==null) return null

    let elmId = await getVideoId(isLocal, userId);

    let oldElement = videoBackground.querySelector(`video#${elmId}`)
    console.log(`bornVideoComponent oldElement:${oldElement} isLocal:${isLocal} userId:${userId} ts:${Date.now()}`)
    if(oldElement != null) {
        return replaceVideoElementWithNewFeed(oldElement, feed, isExistOponent)
    }

    const videoElement = document.createElement('video');
    videoElement.id = elmId;
    videoElement.style.display = 'none'
    videoBackground.appendChild(videoElement);

    videoElement.className = videoElementClassName;

    videoElement.srcObject = feed.stream;
    videoElement.muted = isLocal;

    return videoElement.play().then(()=>{
        // Append the new video element to 'videoBackground'
        (new VideoElementsAppender(videoContainerId, videoElementClassName)).placeVideElements()
        videoElement.style.display = '';
        return videoElement
    })
}

function localVideoElementsCount() {
    return document.getElementById(videoContainerId).querySelectorAll('[id^="local-"]').length
}

function remoteVideoElementsCount() {
    return document.getElementById(videoContainerId).querySelectorAll('[id^="remote-"]').length
}

function removeVideoElement(isLocal, userId) {
    if(isLocal==null || !!userId===false) return

    return getVideoId(isLocal, userId).then(videoId=>{
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
            if(isVideoPlaying(videoElement)) {
                videoElement.pause()
                removeFunc()
            }
            else
                removeFunc()
        }
    })
}

function replaceVideoElementWithNewFeed(element, feed, isExistOponent) {
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
        if(isVideoPlaying(element))
            element.pause()
    })
}

function addListeners(call) {
    let lastError = "";
    call.on(CallEvent.Hangup, function () {

        if(call.hangupReason === CallErrorCode.InviteTimeout && currentRoom && getIsConference(currentRoom)) {
            let aliveCall = Object.values(conferenceCalls).filter(c=>c.feeds.length > 1 && c.feeds.find((feed) => feed.isLocal()))[0]

            const localFeed = aliveCall.feeds.find((feed) => feed.isLocal());
            if(aliveCall && localFeed)
                replaceVideoElementWithNewFeed(document.getElementById(videoContainerId).querySelector('[id^="local-"]'), localFeed, true)
        }

        if((call.hangupReason ===  CallErrorCode.InviteTimeout || call.hangupReason ===  CallErrorCode.UserHangup) && remoteVideoElementsCount() === 0) {
            removeVideoElement(true, client.getUserId())
        }
        else {
            let remoteUserId = call.getOpponentMember() ? call.getOpponentMember().userId : null
            removeVideoElement(false, remoteUserId)
        }

        disableButtons(false, true, true);
        document.getElementById("result").innerHTML = "<p>Call ended. Last error: " + lastError + "</p>";
    });
    call.on(CallEvent.Error, function (err) {
        lastError = err.message;
        call.hangup( CallErrorCode.UserHangup);
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
    let userSelector = document.getElementById("username")

    userSelector.innerHTML = "";
    Object.keys(testUsers).forEach(login=>{
        let option = document.createElement("option");
        option.value = testUsers[login];
        option.text = login;
        userSelector.appendChild(option);
    })

    webcamComboLabel = document.getElementById("webcamComboLabel")
    roomsComboBox = document.getElementById("roomsComboBox");
    connectBtn = document.getElementById("connectBtn")
    let makeConfBtn = document.getElementById("make-conference-btn")
    document.getElementById("result").innerHTML = "<p>Press connect to start connecting.</p>";
    disableButtons(true, true, true);

    connectBtn.onclick = function () {
        document.getElementById('username').value && makeConnect(document.getElementById('username').value)
        document.getElementById("result").innerHTML = "<p>Please wait. Syncing...</p>";
    };

    makeConfBtn.onclick = ()=> {
        let num = 1

        while(
            client.getVisibleRooms()
                .filter(r=> getIsConference(r) && r.name.endsWith(`-${num}`)).length > 0
            ) num++

        client.createRoom({room_alias_name:`conference${Math.random() * Math.pow(10,17)}`, visibility:"private", name:`Conferemce-${num}`, preset:"trusted_private_chat", invite:Object.values(testUsers).filter(u=>u!==client.getUserId())})
    }

    accessCamera(async () => {

        let comboBox = document.getElementById("webcamCombo");
        comboBox.innerHTML = "";
        comboBox.style.display = "";
        webcamComboLabel.style.display = "";

        let defaultDevice1 = null
        let defaultDevice2 = null;

        (await navigator.mediaDevices.enumerateDevices())
            .filter(d=>d.deviceId)
            .forEach(d=> {
                if(defaultDevice1 == null && isCameraOrWebcamName(d.label))
                    defaultDevice1 = d.deviceId
                if(defaultDevice2 == null && d.label.toLowerCase().search("cam")>=0)
                    defaultDevice2 = d.deviceId

                connectBtn.style.display = ""
                let option = document.createElement("option");
                option.value = d.deviceId;
                option.text = d.label;
                comboBox.appendChild(option);
        })

        comboBox.value = defaultDevice1 || defaultDevice2
        webcamComboChanged()
    })
}

let showInfo = function () {
    let roomName = currentRoom.name

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

    connectBtn.innerHTML = "Connected"

};

function startClient() {
    client.on("sync", function (state, prevState, data) {
        switch (state) {
            case "PREPARED":
                calculateHashSha256(client.getUserId()).then(me=>{
                    currentUserIdHash = me;
                    syncComplete();
                    document.getElementById("webcamCombo").disabled = true
                    exitAllJoinedConference();
                }).catch(e=>`Unable to calc userId hash and start client properly!: ${e.message}`)
                break;
        }
    })
    //client.initCrypto().then((x)=>{client.startClient();})
    client.startClient();
}

function exitAllJoinedConference() {
    return client.getJoinedRooms()
        .then(p=>
            Promise.all(p.joined_rooms.map(rid=>
                client
                    .getRoom(rid))

                .filter(r=>getIsConference(r) &&
                    r.currentState.members[client.getUserId()] &&
                    r.currentState.members[client.getUserId()].membership === "join" &&
                    roomsComboBox.value !== r.roomId
                )
                .map(r=>{
                    try {
                        client.leave(r.roomId)
                    } catch (e) {
                        console.log(`Error while ${r.name}.leave():${e.message}`)
                    }
                }))
        )
}

function getIsConference(room) {
    if(!!room === false) return false
    let alias = null
    try {
        alias = room.getCanonicalAlias()
    } catch (e) {
        console.log(`Error while ${room.name}.getCanonicalAlias(): ${e.message}`)
    }
    return !!alias === true && alias!==null && alias.indexOf("conference") -1 >= -1
}

function syncComplete() {

    client.on("RoomMember.membership", function (event, member) {
        let isOurUser = member.userId === client.getUserId()
        let isJoin = member.membership === "join"
        let room = client.getRoom(member.roomId)
        let isConference = getIsConference(room)

        // if(member.membership !== "leave" && !isJoin || !member.roomId) return
        if (member.membership === "invite" && isOurUser && !isConference) {
            client.joinRoom(member.roomId).then(function () {
                console.log("Auto-joined %s", member.roomId);
            });
        }

        if(isJoin && isConference) {
            //leave all other conferences
            if(isOurUser) {
                client.getJoinedRooms().then(r=>{r.joined_rooms.forEach(jroomId=>{
                    let jroom = client.getRoom(jroomId)
                    if(jroomId !== member.roomId && getIsConference(jroom)) {
                        client.leave(jroomId)
                    }
                })})

                let placeCalls = () => {placeConferenceCalls(room.getJoinedMembers().map(m=>m.userId), member.roomId)}
                if(roomId !== member.roomId && getIsConference(currentRoom)) {
                    destroyConferenceUI(roomId).then(placeCalls)
                } else {
                    placeCalls()
                }
            } else {
                placeConferenceCalls([member.userId], member.roomId)
            }
        }

        if(member.membership === "leave" && isOurUser && isConference) {
            destroyConferenceUI(roomId)
        }

        if(member.membership === "leave" && !isOurUser && isConference /*&& client.getUserId()===currentRoom.getCreator()*/ && member.roomId === roomId) {
            inviteLeavedUser(()=>member.roomId, member.userId)
        }

       // oncorlineMatrix.updateRoomServerEvent(member.roomId, isOurUser, isJoin)
        //if(isJoin) {
        //
        // }
        // else
        // isOurUser && oncorlineMatrix.dialogWrapper.serverLeaveRoomEvent();
        //  oncorlineMatrix.updateRoomServerEvent(member.roomId, isOurUser, isJoin)

    });


    let comboBox = roomsComboBox;
    comboBox.style.display = ""
    document.getElementById("myComboBoxLabel").style.display = ""
    // Clear existing options
    comboBox.innerHTML = "";

    client.getVisibleRooms()
        .filter(r=>r.getJoinedMemberCount()>0)
        .forEach(room => {
        let option = document.createElement("option");
        option.value = room.roomId;
        option.text = room.name;
        comboBox.appendChild(option);
    })
    client.getVisibleRooms().length > 0 && comboBoxChanged();

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
            call.hangup( CallErrorCode.UserHangup);
        }

        if(Object.values(conferenceCalls).filter(v=>!!v===true).length > 0) {
            destroyConferenceUI(roomId)
            //on next room
            let other = client.getVisibleRooms()
                .filter(room=> room.roomId !== roomId)
            let comboBox = roomsComboBox
            if(comboBox && other.length > 0) {
                comboBox.value = other[0].roomId
                comboBoxChanged()
            }

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

   /* document.getElementById("remove_group_call").onclick = async function () {
        if(groupCall === null) return;
        groupCall.leave()
        await sleep(300)
        groupCall.dispose()
        await sleep(300)
        groupCall.terminate();
        await sleep(300)
        groupCall = client.getGroupCallForRoom(roomId);
        showInfo();
    };*/

    client.on("Call.incoming", function (c) {
        if(/*c.invitee &&
            c.invitee === client.getUserId() &&*/
            !client.getUserId().includes("user1") &&
            c.getOpponentMember() && c.getOpponentMember().userId &&
            c.roomId &&
            getIsConference(client.getRoom(c.roomId)) &&
                roomId === c.roomId
        ) {
            conferenceCalls[c.getOpponentMember().userId] = c
            addListeners(c);
            sleep(getRandomInt(50,130)).then(()=>c.answer())
            return
        }
        console.log(`Call ringing from ${c.getOpponentMember().userId}`);
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
        if(b.userId && getIsConference(currentRoom) && currentRoom.currentState.members[b.userId] &&
            currentRoom.currentState.members[b.userId].membership === "leave")
            inviteLeavedUser(()=>roomId, b.userId)

        console.log(`User.currentlyActive: ${(b && b.userId) ? b.userId : ""} `) //inspect(b)
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

    client.on("received_voip_event", (x)=>{
        //console.log(`received_voip_event: ${x.event.type}`)
    });

    client.on("toDeviceEvent", (x,y,z)=>{
        console.log(`toDeviceEvent: ${x} ${y} ${z}`)
    });
}

function inviteLeavedUser(roomIdGetter, userId) {
    return sleep(getRandomInt(50,150)).then(()=>{
        if(roomIdGetter() === roomId && currentRoom.currentState.members[userId].membership === "leave")
            client.invite(roomIdGetter(), userId)
    })
}

function isFirstHexHigher(hex1, hex2) {
    // Convert hex strings to integers
    const num1 = parseInt(hex1, 16);
    const num2 = parseInt(hex2, 16);

    // Compare the integers
    return num1 > num2;
}

function invokeIfCurrentUserMustCall(otherUserId, func) {
            if(otherUserId !== client.getUserId())
                return calculateHashSha256(otherUserId).then(other=>{
                    if(isFirstHexHigher(currentUserIdHash, other)) {
                        func()
                    }
                })
            else return new Promise((r, reject)=>{reject("Same user, reject call attempt")})
}

function placeConferenceCalls(userIdList, roomId) {
       userIdList.forEach(userId=>{
           invokeIfCurrentUserMustCall(userId, ()=>{placeConferenceCall(userId, roomId)})
       })
}

function placeConferenceCall(userId, roomId, waitIndex) {

    //if exists room
    let room = client.getRoom(roomId)
    if(!!room === false) return


    let getIsUserOffline = () => room.getJoinedMembers()
        .filter(m=> m.userId &&
            m.userId === userId &&
            m.user &&
            m.user.presence !== "offline"
        ).length === 0
    //if user joined
    if(getIsUserOffline())
        return

    waitIndex = waitIndex || 0
    let sleepOrder = [1, 3, 5, 10]
    let sleepLimit = sleepOrder[waitIndex]
    if(sleepLimit == null) return;
    sleepLimit *= 1000
    let actualSleep = getRandomInt(sleepLimit > 1000 ? sleepLimit - 1000 : 100 ,sleepLimit)
    sleep(actualSleep).then(()=> {
        //check is answer already
        if(room.timeline
            .filter(x=>x.event.type === "m.call.answer" &&
                x.event.sender === userId && Date.now() - x.localTimestamp < 3000).length > 0 ||

        conferenceCalls[userId] && conferenceCalls[userId].state === 'connected' ||
            getIsUserOffline()) {
            return
        }
        //Destroy old call
        destroyCall(conferenceCalls[userId])
        //create new
        console.log(`placeConferenceCall: userId:${userId}, room:${room.name}, actualSleep: ${actualSleep}`)
        let options = {invitee:userId}
        conferenceCalls[userId] = matrixcs.createNewMatrixCall(client, roomId, options);
        addListeners(conferenceCalls[userId]);
        conferenceCalls[userId].placeVideoCall();
        //try again if fail now
        placeConferenceCall(userId, roomId, ++waitIndex)
    })
}

function destroyCall(targetCall) {
    if(!!targetCall===false) return
    try {
        if(targetCall.state !== 'connected') {
            call.off(CallEvent.Hangup);
            call.off(CallEvent.Error);
            call.off(CallEvent.FeedsChanged);
        }
        targetCall.hangup( CallErrorCode.InviteTimeout);
    } catch (e) {
        console.log("Error hangup lost call:"+e.message)
    }
}

function destroyConferenceUI(roomId) {

    let room = client.getRoom(roomId)
    if(!!room === false || false === getIsConference(room)) return new Promise(()=>false)

    return Promise.all(room.getJoinedMembers()
        .map(m=>m.userId)
        .map(yaId=>{
            return Promise.all([
            //stop all streams
            removeVideoElement(client.getUserId()===yaId, yaId),
            //destroy all calls
                new Promise(()=> {
                    if (conferenceCalls[yaId])
                        destroyCall(conferenceCalls[yaId])
                    conferenceCalls[yaId] = null
                })])
        })).then(()=>{
            if(room.selfMembership==='join')
                client.leave(roomId)
    })
}

function comboBoxChanged() {
    if(getIsConference(currentRoom) && roomsComboBox.value !== roomId)
        client.leave(roomId)
    roomId = roomsComboBox.value;
    currentRoom = client.getRoom(roomId)
    groupCall = client.getGroupCallForRoom(roomId);

    if(currentRoom && currentRoom.selfMembership!=="join")
        sleep(50).then(()=>client.joinRoom(roomId))
    disableButtons(!!groupCall===true, true, true);

    showInfo();
}

function webcamComboChanged() {
    let comboBox = document.getElementById("webcamCombo");
    if(comboBox.value)
        deviceId = comboBox.value
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

function currentMembers() {
    console.log(`currentMembers of ${currentRoom.name}`)
    return currentRoom.currentState.members
}

let isCameraOrWebcamName = function (text) {
    // Regular expression to match 'camera' or 'webcam' at the start of the string or after a space
    // and not after an open brace '{'
    const regex = /^(camera|webcam)|(?<!\(.*)\b( camera| webcam)\b/gi;

    // Search for the pattern in the text
    const matches = text.match(regex);

    // Return the matches
    return (matches || []).length > 0;
}
