#Matrix-js-sdk video conference example

#Deploying
1. Rename const.js.example to const.js.
   Input you're matrix testing server, testing userId's and pass.
   I'm using synapse matrix server with turn server running at docker containers.
2. Launch web server on project root dir i.e. index.html and js folder.
   For example this may be command "python.exe -m http.server 8003" execute in project root dir folder.
   If you using home server you can option to port forwarding on your router and forward some port (80 or 8080) you'r dedicated ip to port:ip of you'r home server.
   Then link any free or paid domain to you'r dedicated ip. Then any internet user can access you'r matrix frontend conference.
3. Go to you'r matrix frontend at least 3 different PC. You can use virtual machines with virtual camera software.
   Use button "Make conference" to make conference room. All users from testUsers (defined at consts.js) will be invited automatically.
   You'r must select conference room in comboBox to join conference.
   Streaming will start automatically on user's join.


###Notes
#Olm installing
yarn add https://packages.matrix.org/npm/olm/olm-3.1.4.tgz

#Create room:
client.createRoom( {room_alias_name:"conference31112A", visibility:"private", name:"Conferemce-1", preset:"trusted_private_chat", invite:["@user:devmatrix.linkpc.net","@user1:devmatrix.linkpc.net","@mhalane:devmatrix.linkpc.net","@registr:devmatrix.linkpc.net","@igrin:devmatrix.linkpc.net"]})