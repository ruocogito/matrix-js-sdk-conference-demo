import "/js/lib/bundle.js";
import * as utils from "/js/Utils.js";
import * as ui from "/js/ui.js";
import {
    CallErrorCode,
    CallEvent,
    LogLevel,
    RoomEvent,
    MessageType,
    EventType,
    maxUpdateMessageListAttempts,
    daysToScrollbackInRoomHistory,
    JoinRule
} from "/js/Enums.js"
import {testUsers, testPass, BASE_URL} from "/js/consts.js";
import {StorageInfo} from "/js/StorageInfo.js";
import {
    addMessageToList,
    clearMessageList, disableClientContentDisplaying, selectedRoomId,
    showError,
    showNote, fToggleCameraBtn, toggleCurrentRoomUi, toggleMakeConfBtn,
    toggleUserPreference,
    updateRoomMembersContainer
} from "/js/ui.js";
import {sleepRandom, streamInfo} from "/js/Utils.js";

export let actualServerURL = null
export let actualPass = testPass;

export let roomId;
export let currentRoom = null;
let groupCall;
let call;
let client = null;
let conferenceCalls = {}
let deviceId = null
export let currentUserId = null

let currentUserIdHash = null

export let storageInfo = new StorageInfo()

let currentLogLevel = LogLevel.ERROR

let getActualServerURL = () => {
    actualServerURL = actualServerURL || ui.getServerFieldValue() || BASE_URL;
    return actualServerURL
}

export let ifServerAliveThen = () => fetch(`${getActualServerURL()}/_matrix/client/versions`)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if(data.versions == null || !!data.versions.length === false)
            throw new Error('versions response is not matrix versions');
        return data
    })

// Create a function to find out who the user is with authentication
export function loginWithToken(accessToken) {
    // Define the URL for the Matrix server whoami endpoint
    const whoAmIUrl = '/_matrix/client/v3/account/whoami';

    // Use the Fetch API to make a GET request to the Matrix server with the access token
    return fetch(`${actualServerURL}${whoAmIUrl}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
        .then(response => response.json())
        .catch(error => {
            // Log any errors that occur during the fetch
            showError(`whoami response: errcode:${error.errcode}`, error.error)
        })
        .then(data => {
            // Check if the user_id is present
            if (data.user_id) {
                showNote(`Cookies authenticated! Your Matrix ID is: ${data.user_id}`);
                makeConnect(data.user_id, accessToken)
            } else {
                showError('Authentication with cookies token failed.');
            }
        })
}
//

export function makeConnect(userId, token) {
    ui.setIsCanConnect(true)

    return ui.getIfDeviceExist(ui.selectedWebCam()).then(device=> {
        if(!!device === false) {
            ui.showError("Unable retrieve video device, can not start client!")
            return false
        }

        let onSuccess = async (accessDat) => {
            storageInfo.save(device.deviceId, accessDat.access_token)
            console.log("login success with access token:" + accessDat.access_token);
            ui.accessCamera(async () => {

                client = matrixcs.createClient({
                    baseUrl: actualServerURL,
                    accessToken: accessDat.access_token,
                    userId: userId,
                    deviceId: device.deviceId,
                    useE2eForGroupCall: false
                })

                let refreshToken = client.getRefreshToken()
                refreshToken && client.refreshToken(refreshToken).then(r=>
                    storageInfo.save(device.deviceId,  r.access_token)
                ).catch(e=>ui.showError(e.message))

                //Olm.init({locateFile: () => './js/node_modules/@matrix-org/olm/olm.wasm'}).then((x)=>{

                // client.initCrypto().then(() => {
                //console.log('Olm initialized for encryption.');

                startClient()
                ui.toggleUserPreference()
                //})})

            });
            return true
        };

        let loginWithPass = (authClient) => {
            return token == null && authClient
                .loginWithPassword(userId, testPass || ui.getEnteredPass() )
                .then(onSuccess)
                .catch(e=>{ui.showError(e.message);return false})
        }

        ((token, authClient) =>
            token &&
            onSuccess({access_token:token})
            .catch(e => {
                    ui.showError(e.message);
                }) || loginWithPass(authClient))(
                    storageInfo.token,
                    matrixcs.createClient({baseUrl: actualServerURL})
                );
    })
        .then(()=>{ ui.setIsCanConnect(false)})
        .catch(()=>{ ui.setIsCanConnect(false)})
}

function startClient() {
    client.on("sync", function (state, prevState, data) {
        switch (state) {
            case "PREPARED":
                utils.calculateHashSha256(client.getUserId()).then(me => {
                    ui.setLoginButtonText("Relogin")
                    client.logger.setLevel(currentLogLevel)
                    currentUserIdHash = me;
                    currentUserId = client.getUserId()
                    ui.setUserName(client.getUser(currentUserId).displayName)
                    syncComplete();
                    ui.setIsCanSelectWebCam(true)
                    exitAllJoinedConference();
                }).catch(e=>`Unable to calc userId hash and start client properly!: ${e.message}`)
                break;
        }
    })
    //client.initCrypto().then((x)=>{client.startClient();})
    client.startClient();
}

function syncComplete() {

    client.on(RoomEvent.Membership, function (event, member) {
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
            destroyConferenceUI(member.roomId)
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

    //fill room's selection
    ui.enableClientContentDisplaying()
    ui.toggleCurrentRoomUi(true)

    ui.clearRoomsInSelection()

    ui.addRoomForSelection("", "--- none ---")
    client.getVisibleRooms()
        .filter(r=>r.getJoinedMemberCount()>0)
        .forEach(room => ui.addRoomForSelection(room.roomId, room.name) )

    ui.selectAnyRoom()

    ui.showNote("Ready for calls.")
    ui.disableButtons(false, true, true);

    ui.addCalControlListeners()

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

    client.on(RoomEvent.CallIncoming, function (c) {
        if(/*c.invitee &&
            c.invitee === client.getUserId() &&*/
            !client.getUserId().includes("user1") &&
            c.getOpponentMember() && c.getOpponentMember().userId &&
            c.roomId &&
            getIsConference(client.getRoom(c.roomId)) &&
            roomId === c.roomId
        ) {
            conferenceCalls[c.getOpponentMember().userId] = c
            addCallListeners(c);
            utils.sleepRandom(50,130).then(()=>c.answer())
            ui.disableButtons(true, true, false);
            return
        }
        console.log(`Call ringing from ${c.getOpponentMember().userId}`);
        ui.disableButtons(true, false, false);
        showNote("Incoming call...")
        call = c;
        addCallListeners(call);
    });

    client.on(RoomEvent.UserPresence, (u,b)=>{
        //console.log("User.presence: u"+ inspect(u))
        //console.log("User.presence: b"+ inspect(b))
    })

    client.on(RoomEvent.UserCurrentlyActive, (u,b)=>{
        //console.log("User.currentlyActive: u ") //+ inspect(u)
        if(b.userId && getIsConference(currentRoom) && currentRoom.currentState.members[b.userId] &&
            currentRoom.currentState.members[b.userId].membership === "leave")
            inviteLeavedUser(()=>roomId, b.userId)

        console.log(`User.currentlyActive: ${(b && b.userId) ? b.userId : ""} `) //inspect(b)
    })

    client.on(RoomEvent.ReceivedVoipEvent, (x)=>{
        //console.log(`received_voip_event: ${x.event.type}`)
    });

    client.on(RoomEvent.Timeline, (e)=>{
        //console.log(`${RoomEvent.Timeline}: ${inspect(e)} `)
        if(Date.now() - e.localTimestamp >= 3000 ||
            e.event == null || e.event.room_id == null || e.event.room_id !== roomId) return
        addMessageToList(e)
    })
}

//Buttons events

export let onUserWantConnect = () => {
    disableClientContentDisplaying()
    ui.selectedUserId() && makeConnect(ui.selectedUserId())
    ui.showNote("Please wait. Syncing...")
}

function toggleLocalFeed(call) {
    call.getLocalFeeds().find((feed) => feed.isLocal()).stream.getVideoTracks().map(x => x.enabled = !x.enabled)
}

export let onToggleCamera = function () {
    if(currentRoom == null) return
    if(!getIsConference(currentRoom))
        toggleLocalFeed(call)
    else {
        Object.keys(conferenceCalls).forEach(yaUser => {
            let confCall = conferenceCalls[yaUser]
            if(confCall)
                toggleLocalFeed(confCall)
        })
    }
}

export let onMakeConference = ()=> {
    let num = 1

    while(
        client.getVisibleRooms()
            .filter(r=> getIsConference(r) && r.name.endsWith(`-${num}`)).length > 0
        ) num++
    let conferenceName = `Conferemce-${num}`

    let usersToInvite = (()=>{
        if(actualServerURL !== BASE_URL)
            return client.getUsers().map(u=>u.userId)
        return Object.values(testUsers).filter(u=>u!==client.getUserId())
    })()

    client
        .createRoom({
            room_alias_name:`conference${Math.random() * Math.pow(10,17)}${utils.getRandomString(5)}`,
            visibility:"private",
            name:conferenceName,
            preset:"trusted_private_chat",
            invite:usersToInvite
        })
        .then(roomId => {
            ui.addRoomForSelection(roomId, conferenceName)
            ui.setSelectedRoom(roomId)
            onChangeSelectRoom()
        })
        .catch(e=>{
            ui.showError("Error creating room: ", e.message)
        })
}

export let onUserCall = function () {
    console.log("Placing call...");
    let options = {}
    call = matrixcs.createNewMatrixCall(client, roomId, options);
    //console.log("Call => %s", call);
    addCallListeners(call);
    call.placeVideoCall().then(()=>{
        ui.showNote("Placed call.")
        ui.disableButtons(true, true, false);
    })
};

export let onUserHangup = function () {

    if(call) {
        console.log("Hanging up call...");
        console.log("Call => %s", call);
        call.hangup(CallErrorCode.UserHangup);
    }

    if(Object.values(conferenceCalls).filter(v=>!!v===true).length > 0) {
        destroyConferenceUI(roomId)
        //on next room
        ui.selectOtherRoom()

        ui.disableButtons(true, true, true);
    }

    ui.showNote("Hangup call.")
};

export let onAnswer = function () {
    console.log("Answering call...");
    console.log("Call => %s", call);
    call.answer();
    ui.disableButtons(true, true, false);
    ui.showNote("Answered call.")
};

//Combo events

export function onChangeSelectRoom() {
    if(getIsConference(currentRoom) && ui.selectedRoomId() !== roomId)
        client.leave(roomId)

    let selectedRoom = ui.selectedRoomId() && client.getRoom(ui.selectedRoomId())
    if(!!selectedRoom === false) {
        toggleCurrentRoomUi(true)
        roomId = null
        currentRoom = null
        return;
    }

    let resolveSelectAction = () => {

        roomId = selectedRoom.roomId
        currentRoom = selectedRoom

        updateRoomMembersContainer()
        updateMessageList()
        leavedConferenceInviteThinker(roomId)

        ui.disableButtons(!getIsConference(currentRoom), true, false);
        ui.toggleMakeConfBtn(getIsConference(currentRoom))

        toggleCurrentRoomUi(false)
    }

    if(selectedRoom.selfMembership==="join") {
        resolveSelectAction()
        return;
    }

    utils.waitUntil( () =>
        selectedRoom.selfMembership !=="join" && selectedRoom.getJoinRule() !== JoinRule.PUBLIC &&
        (selectedRoom.getJoinRule() === JoinRule.INVITE && selectedRoom.selfMembership === 'invite')
    ).then(()=>{
        client.joinRoom(selectedRoom.roomId)
            .then(resolveSelectAction)
    }).catch(e=>{
        showError(`Unable join room ${selectedRoom.name}: ${e.message}`)
        ui.toggleCurrentRoomUi(true)
    })
}

function loadMessagesFromPastDays(room, daysToScrollback, earliestEventTimestamp = new Date().getTime()) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysToScrollback);

    // Check if the earliest event is older than the target date
    if (earliestEventTimestamp > targetDate.getTime() && room.timeline.find(e=>e.event.type === EventType.CREATE) === null) {
        return client.scrollback(room, 100).then((room) => {
            // Update the earliest event timestamp with the oldest event in the timeline
            const timeline = room.timeline;
            earliestEventTimestamp = timeline[timeline.length - 1].getTs();

            // Recursively load more messages if needed
            return loadMessagesFromPastDays(room, daysToScrollback, earliestEventTimestamp);
        })
    }
    // We have reached the messages from the specified number of days ago
    //console.log(`Loaded messages from the past ${daysToScrollback} days`);
    return new Promise((t,c)=>t(room))
}

let updateMessageList = (numAttempt) => {
    ui.clearMessageList()
    if(currentRoom == null) return
    if(numAttempt == null) {
        numAttempt = 0
    }
    if(numAttempt >= maxUpdateMessageListAttempts) {
        showError(`The maxUpdateMessageListAttempts passed, cannot update room ${currentRoom.name}`)
    }

    if(currentRoom.selfMembership!=="join") {
        sleepRandom(10, 60).then(()=>updateMessageList(++numAttempt))
        return;
    }

    loadMessagesFromPastDays(currentRoom, daysToScrollbackInRoomHistory).then((room) => {
        room.timeline.forEach(e => {
            addMessageToList(e)
        })
    })
}

export function onWebcamComboChanged() {
    if(ui.selectedWebCam())
        deviceId = ui.selectedWebCam()
}

//Call Events

function addCallListeners(call) {
    call.on(CallEvent.Hangup, onHangupEvent);

    call.on(CallEvent.Error, onCallError);

    call.on(CallEvent.FeedsChanged, onFeedsChangedEvent);
}

let lastOnFeedsChanged = -Infinity;
let onFeedsChangedEvent = function (feeds) {

    if(Date.now() - lastOnFeedsChanged < 250) {
        (async ()=>{
            await utils.sleepRandom(300, 500);
            onFeedsChangedEvent(feeds)
        })();
        return
    }
    lastOnFeedsChanged = Date.now()

    const localFeed = feeds.find((feed) => feed.isLocal());
    const remoteFeed = feeds.find((feed) => !feed.isLocal());

    console.log(`onFeedsChanged: isLocal:${(!!localFeed)}, size:${feeds.length}` )

    ui.videoElementsAppender
        .bornVideoComponent(false, remoteFeed && remoteFeed.userId, remoteFeed, null)
        .then((remoteElement)=>{
            if(remoteElement) console.log(streamInfo("Remote", remoteFeed.stream))
    })
        .catch(e=>console.log(`Error during bornVideoComponent: ${e.message}`))
        .then(()=>{
            if (ui.videoElementsAppender.localVideoElementsCount() < 1 || remoteFeed) {
                ui.videoElementsAppender
                    .bornVideoComponent(true, client.getUserId(), localFeed, remoteFeed != null)
                    .then((localElement)=>{
                        if(localElement) {
                            console.log(streamInfo("Local", remoteFeed.stream))
                            ui.fToggleCameraBtn(false)
                        }
                })
                    .catch(e=>console.log(`Error during bornVideoComponent: ${e.message}`))
            }
    })
}

let onHangupEvent = () => {
    if(call.hangupReason === CallErrorCode.InviteTimeout && currentRoom && getIsConference(currentRoom)) {
        let aliveCall = Object.values(conferenceCalls).filter(c=>c.feeds.length > 1 && c.feeds.find((feed) => feed.isLocal()))[0]

        const localFeed = aliveCall.feeds.find((feed) => feed.isLocal());
        if(aliveCall && localFeed)
            ui.videoElementsAppender.replaceVideoElementWithNewFeed(ui.videoElementsAppender.getFirstLocalElement(), localFeed, true)
    }

    if((call.hangupReason ===  CallErrorCode.InviteTimeout || call.hangupReason ===  CallErrorCode.UserHangup) && ui.videoElementsAppender.remoteVideoElementsCount() === 0) {
        ui.videoElementsAppender.removeVideoElement(true, client.getUserId())
    }
    else {
        let remoteUserId = call.getOpponentMember() ? call.getOpponentMember().userId : null
        ui.videoElementsAppender.removeVideoElement(false, remoteUserId)
    }

    ui.disableButtons(false, true, true);
}

let onCallError = function (err) {
    ui.showError("Call ended. Last error: ", err.message)

    call.hangup( CallErrorCode.UserHangup);
    ui.disableButtons(false, true, true);
}

//Matrix logic

function exitAllJoinedConference() {
    return client.getJoinedRooms()
        .then(p=>
            Promise.all(p.joined_rooms.map(rid=>
                client
                    .getRoom(rid))

                .filter(r=>getIsConference(r) &&
                    r.currentState.members[client.getUserId()] &&
                    r.currentState.members[client.getUserId()].membership === "join" &&
                    ui.selectedRoomId() !== r.roomId
                )
                .map(r=>{
                    try {
                        client.leave(r.roomId)
                    } catch (e) {
                        ui.showError(`Error while ${r.name}.leave():${e.message}`)
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
        ui.showError(`Error while ${room.name}.getCanonicalAlias(): ${e.message}`)
    }
    return !!alias === true && alias!==null && alias.indexOf("conference") -1 >= -1
}

function inviteLeavedUser(roomIdGetter, userId) {
    return utils.sleepRandom(20,70).then(()=>{
        if(roomIdGetter() === roomId && currentRoom.currentState.members[userId].membership === "leave")
            client.invite(roomIdGetter(), userId)
    })
}

function leavedConferenceInviteThinker(roomId) {
    if(currentRoom.roomId !== roomId)
    if(currentRoom == null) return
    if(getIsConference(currentRoom) === false) return

    Object.keys(currentRoom.currentState.members).forEach(yaId => {
        if(currentRoom.currentState.members[yaId].membership === "leave" && yaId !== currentUserId)
            inviteLeavedUser( ()=>currentRoom, yaId)
    })
    sleepRandom(1500, 2000).then(()=>leavedConferenceInviteThinker(roomId))
}

function invokeIfCurrentUserMustCall(otherUserId, func) {
            if(otherUserId !== client.getUserId())
                return utils.calculateHashSha256(otherUserId).then(other=>{
                    if(utils.isFirstHexHigher(currentUserIdHash, other)) {
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
    if(room.selfMembership!=='join') return
    if(currentRoom.roomId !== roomId) return

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
    let actualSleep = utils.getRandomInt(sleepLimit > 1000 ? sleepLimit - 1000 : 100 ,sleepLimit)
    utils.sleep(actualSleep).then(()=> {
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
        addCallListeners(conferenceCalls[userId]);
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
        targetCall.hangup( CallErrorCode.InviteTimeout );
    } catch (e) {
        console.log("Error hangup lost call:" + e.message)
    }
}

function destroyConferenceUI(roomId) {

    ui.fToggleCameraBtn(true)

    let room = client.getRoom(roomId)
    if(!!room === false || false === getIsConference(room)) return new Promise(()=>false)

    let members = room.getJoinedMembers()
    members.push(client.getUser(currentUserId))

    return Promise.all(members
        .map(m=>m.userId)
        .map(yaId=>{
            return Promise.all([
                //stop all streams
                ui.videoElementsAppender.removeVideoElement(currentUserId === yaId, yaId),
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

window.project_debug = ()=> {return {
    currentMembers: function currentMembers() {
        console.log(`currentMembers of ${currentRoom.name}`)
        return currentRoom.currentState.members
    },

    client: client,

    currentRoom: currentRoom,

    conferenceCalls:conferenceCalls
}}

export let isCurrentMatrixConnectionActive = () => {
    try {
        return !!client && client.getVisibleRooms() != null
    } catch (e) {
        return false
    }
}

export let getUserName = (userId) => client && client.getUser(userId) && client.getUser(userId).displayName || ''

export let getUser = (userId) => client && client.getUser(userId)

let sendMessage = (messageText) => {
    const content = {
        body: messageText,
        msgtype: MessageType.text
    };

    client.sendEvent(roomId, EventType.MESSAGE, content, "", (err, res) => {
        if (err) {
            showError(err)
        } else {
            //console.log("Message sent successfully", res);
        }
    });

}

export function onMessageInput(e) {
    if (e.key === 'Enter' && e.currentTarget.value) {
        sendMessage(e.currentTarget.value)
        e.currentTarget.value = ""
    }
}





