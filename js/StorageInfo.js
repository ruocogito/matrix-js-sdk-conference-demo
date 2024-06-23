export class StorageInfo {
    constructor() {
        this.storageItemName = "matrixDemoStorageInfo"
    }
    load() {
        let obj = ((json)=>json && JSON.parse(json))(localStorage.getItem(this.storageItemName))
        if(obj && obj.deviceId && obj.token) {
            this.deviceId = obj.deviceId
            this.token = obj.token
            return this
        }
        return null
    }
    save(deviceId, token) {
        this.deviceId = deviceId || this.deviceId
        this.token = token || this.token

        if(!this.deviceId || !this.token) return
        localStorage.setItem(this.storageItemName, JSON.stringify(this))
    }
}
