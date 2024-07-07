export let CallErrorCode = {
    UserHangup : "user_hangup",
    InviteTimeout : "invite_timeout"
    //other not included
}

export let CallEvent = {
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

export let LogLevel = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    SILENT: 5,
}

export let EventType = {
    MESSAGE: 'm.room.message',
    CREATE: 'm.room.create'
}

export let JoinRule = {
    PUBLIC: 'public',
    INVITE: 'invite'
}

export let RoomEvent = {
    Membership: "RoomMember.membership",
    Timeline: "Room.timeline",
    CallIncoming: "Call.incoming",
    UserPresence: "User.presence",
    UserCurrentlyActive: "User.currentlyActive",
    ReceivedVoipEvent: "received_voip_event"
}

export let MessageType = {
    text: "m.text"
}

export const maxUpdateMessageListAttempts = 5
export const daysToScrollbackInRoomHistory = 7
export const defaultMaxWhiteUntilCondition = 3000

export const backgroundColors = [
    [{r:83, g:29, b:138}, {r:66, g:192, b:179}],
    [{r:52, g:52, b:169}, {r:147, g:61, b:246}],
    [{r:100, g:30, b:107}, {r:91, g:150, b:182}]
    [{r:98, g:17, b:31}, {r:98, g:70, b:11}]
]