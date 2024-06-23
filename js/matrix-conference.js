import "/js/lib/bundle.js";
import * as utils from "/js/Utils.js";
import * as ui from "/js/ui.js";
import {CallErrorCode, CallEvent, LogLevel} from "/js/Enums.js"
import {testUsers, testPass, BASE_URL} from "/js/consts.js";
import {StorageInfo} from "/js/StorageInfo.js";
import {showError, showNote} from "/js/ui.js";
import {streamInfo} from "/js/Utils.js";

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

export let ifServerAliveThen = () => fetch(`${BASE_URL}/_matrix/client/versions`)
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
    return fetch(`${BASE_URL}${whoAmIUrl}`, {
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
                    baseUrl: BASE_URL,
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
                //})})

            });
            return true
        };

        let loginWithPass = (authClient) => {
            return token == null && authClient
                .loginWithPassword(userId, testPass)
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
                    matrixcs.createClient({baseUrl: BASE_URL})
                );
    })
        .then(()=>{ ui.setIsCanConnect(false)})
        .catch(()=>{ ui.setIsCanConnect(false)})
}

function startClient() {
    client.on("sync", function (state, prevState, data) {
        switch (state) {
            case "PREPARED":
                utils.calculateHashSha256(client.getUserId()).then(me=>{
                    client.logger.setLevel(currentLogLevel)
                    currentUserIdHash = me;
                    currentUserId = client.getUserId()
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

    //fill room's selection
    ui.enableRoomSelectionDisplaying()

    ui.clearRoomsInSelection()

    client.getVisibleRooms()
        .filter(r=>r.getJoinedMemberCount()>0)
        .forEach(room => ui.addRoomForSelection(room.roomId, room.name) )

    client.getVisibleRooms().length > 0 && onChangeSelectRoom();

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
            addCallListeners(c);
            utils.sleepRandom(50,130).then(()=>c.answer())
            return
        }
        console.log(`Call ringing from ${c.getOpponentMember().userId}`);
        disableButtons(true, false, false);
        showNote("Incoming call...")
        call = c;
        addCallListeners(call);
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

    client.on("received_voip_event", (x)=>{
        //console.log(`received_voip_event: ${x.event.type}`)
    });
}

//Buttons events

export let onUserWantConnect = () => {
    ui.selectedUserId() && makeConnect(ui.selectedUserId())
    ui.showNote("Please wait. Syncing...")
}

export let onToggleCamera = function () {
    call.getLocalFeeds().find((feed) => feed.isLocal()).stream.getVideoTracks().map(x => x.enabled = !x.enabled)
}

export let onMakeConference = ()=> {
    let num = 1

    while(
        client.getVisibleRooms()
            .filter(r=> getIsConference(r) && r.name.endsWith(`-${num}`)).length > 0
        ) num++
    let conferenceName = `Conferemce-${num}`

    client
        .createRoom({room_alias_name:`conference${Math.random() * Math.pow(10,17)}`, visibility:"private", name:conferenceName, preset:"trusted_private_chat", invite:Object.values(testUsers).filter(u=>u!==client.getUserId())})
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
        call.hangup( CallErrorCode.UserHangup);
    }

    if(Object.values(conferenceCalls).filter(v=>!!v===true).length > 0) {
        destroyConferenceUI(roomId)
        //on next room
        ui.selectOtherRoom()

        ui.disableButtons(false, true, true);
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
    roomId = ui.selectedRoomId()
    currentRoom = client.getRoom(roomId)

    if(currentRoom && currentRoom.selfMembership!=="join")
        utils.sleep(50).then(()=>client.joinRoom(roomId))
    ui.disableButtons(!!groupCall===true, true, true);

    ui.showInfo();
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

    ui.videoElementsAppender.bornVideoComponent(false, remoteFeed && remoteFeed.userId, remoteFeed, null)
        .then((remoteElement)=>{
        if(remoteElement) console.log(streamInfo("Remote", remoteFeed.stream))

    })
        .catch(e=>console.log(`Error during bornVideoComponent: ${e.message}`)).then(()=>{
        if (ui.videoElementsAppender.localVideoElementsCount() < 1 || remoteFeed) {
            ui.videoElementsAppender.bornVideoComponent(true, client.getUserId(), localFeed, remoteFeed != null).then((localElement)=>{
                if(localElement) console.log(streamInfo("Local", remoteFeed.stream))
            }).catch(e=>console.log(`Error during bornVideoComponent: ${e.message}`))
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
    return utils.sleepRandom(50,150).then(()=>{
        if(roomIdGetter() === roomId && currentRoom.currentState.members[userId].membership === "leave")
            client.invite(roomIdGetter(), userId)
    })
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
                ui.videoElementsAppender.removeVideoElement(client.getUserId()===yaId, yaId),
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

    client: client
}}




