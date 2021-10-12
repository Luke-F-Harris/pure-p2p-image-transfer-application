// IMPORTS
let net = require('net');
let path = require('path');
let fs = require('fs');
let singleton = require('../Server/Singleton');
let mPackets = require('../Server/MessagePackets');
let binary_h = require('../BinaryHandler');
let sPackets = require('../Server/SearchPacket');
let rPackets = require('../Server/ResponsePackets');

// PARSING COMMAND LINE ARGS

// declarations
let self_peer_port = ''; // will be random
let self_image_port = ''; // will be random
let connect_to_port = ''; // the port that the peer will try to connect to
let connect_to_host = ''; // host address peer will connect to
let port_table = []; // list of ports connect to this peer 
let connections = [];
let peer_connections = [];
let seen_packets = [];
let connection_stated = false; // notifies if -p was commanded
let peer_id; // id of peer
let port_table_max_length; // max length of allowed connections
let folder_name = path.basename(__dirname); // folder name to decide table length and peer id
let self_host = '127.0.0.1';
let searching_packet = "";
let found_image_packets = [];
let stored_origin;


// array of command line arguments
let input_commands = process.argv.slice(2);

// if arguments are inputted
if (input_commands.length > 0) {

        // case where more than just '-p server-ip' is inputted
        input_commands.length > 2 ? throwError("args") : null;

        // case where no address following -p command
        input_commands.length == 1 ? throwError("no address") : null;

        // command is not -p
        input_commands[0] != "-p" ? throwError('command') : null

        // assign host and port from address
        let ip = input_commands[1];
        connect_to_host = ip.split(':')[0];
        connect_to_port = ip.split(':')[1];
        connection_stated = true;
}

// PARSING FOLDER NAME FOR PEER INFO

if (folder_name.substring(0, 4) === "peer") {
        // Gets peer id from folder name
        peer_id = getPeerId(folder_name);
        port_table_max_length = getPeerTableSize(folder_name);
} else {
        throwError('folder');
}

// ASSINGING RANDOM PORT TO THIS PEER

self_peer_port = Math.floor(Math.random() * 16383) + 49152;
self_image_port = Math.floor(Math.random() * 16383) + 49152;



// performs redirect
function advancedRedirect(incoming_peer_table, client) {

        // table of rejections to peers
        let rejected_table = incoming_peer_table;

        // console.log("\nThe join has been declined; the auto-join process is performing...\n");
        if (rejected_table.length < 1) {
                return;
        }
        // formNewPeerConnection(rejected_table, client, index);
        if (client != null) {

                client.destroy();
        }
        console.log(`\nThe join has been declined; the auto-join process is performing...`);

        formNewPeerConnection(rejected_table, client);
}


// forms new connection to peer
function formNewPeerConnection(port_table, socket) {

        if (socket != null) {
                socket.destroy();
        }

        let client = new net.Socket();
        client.connect(port_table[0], '127.0.0.1', function () {
                client.write(self_peer_port.toString());
                client.on('data', function (data) {

                        // if data is a search packet (from another peer server that could not find images)
                        if (getPacketType(data) == "request") {
                                [search_id, origin_port, image_names, images, original_data, sender_id, mess_type, images_types, version, timestamp] = readSearchPacket(data);
                                let [found, found_images] = searchForImages(images);

                                if (found == 1 || found_images.length > 0) {
                                        let response_packet = rPackets.getResponsePacket(version, "1", "1", found_images.length, singleton.getSequenceNumber(), singleton.getTimestamp(), found_images);
                                        tempConnection(origin_port, response_packet);
                                } else {
                                        let search_id = parseInt(data.slice(16, 24).toString(), 2);
                                        seen_packets.includes(search_id) ? true : seen_packets.push(search_id);
                                        peer_connections.forEach(peer => {
                                                peer.write(data);
                                        });
                                }
                        } else {
                                let redirect = parseInt(data.toString().substring(3, 11), 2); // redirect value (1 or 2)
                                let incoming_peer_table = getTable(data.toString()); // list of peers connected to server peer
                                let sender_id_length = parseInt(data.toString().substring(24, 32), 2);
                                let number_of_peers = getNumberOfPeers(data.toString()); // number of peers connected to server peer

                                // if port table of connecting to peer is not full
                                if (redirect != 2) {

                                        console.log(`\nConnected to peer peer${parseInt(data.toString().substring(32, 32 + (sender_id_length * 8)), 2)}:${port_table[0]} at timestamp ${singleton.getTimestamp()}`)
                                        console.log(`\nThis peer address is ${'127.0.0.1'}:${self_peer_port} located at peer${peer_id}`);
                                        console.log(`\nRecieved ack from peer${parseInt(data.toString().substring(32, 32 + (sender_id_length * 8)), 2)}:${port_table[0]}`);

                                        let peer_list = "";

                                        if (number_of_peers > 0) {
                                                if (incoming_peer_table.length >= 1) {
                                                        for (let i = 0; i < incoming_peer_table.length; i++) {
                                                                peer_list += `[127.0.0.1:${incoming_peer_table[i]}], `
                                                        }
                                                }
                                                console.log(`     which is peered with: ${peer_list.substring(0, peer_list.length - 2)}`);
                                        }
                                } else {

                                        // if port table of connecting to peer is full perform redirect
                                        // PERFORM ADVANCED REDIRECT
                                        advancedRedirect(incoming_peer_table, client);
                                        // pick a new port to connect to, try to connect, if able destroy and form new connection
                                        // if not able try to connect to another
                                        // if non able, just destroy

                                }
                        }
                });
                client.on('close', function () {
                        client.end();
                        client.destroy();
                });
        });
        client.on('error', function (err) {
                console.log('\nNo peers to connect to...');
                console.log("Closing connection");
                client.destroy();
        });
}

let peer_server;
// forms peer server
function formPeerServer(port) {
        // CREATING SERVER PEER (All are server peers and client peers)

        let message_packet;
        // all peers are servers so all will run this
        peer_server = net.Server();
        peer_server.listen(port, '127.0.0.1');
        peer_server.on('listening', () => {
                connection_stated ? true : console.log(`\nThis peer address is ${'127.0.0.1'}:${port} located at peer${peer_id}`);
        });
        peer_server.on('connection', function (socket) {
                // server recieves port from client connecting
                // server also receives search packets from other peers
                peer_connections.push(socket);
                socket.on('data', function (data) {

                        let port_pushed = false;
                        // image server communications

                        // if data message type is 3 it is a search packet and if 1 or 2 it is a message packet
                        if (getPacketType(data) == "request") {
                                // receiving a search packet from image server taht got it from getImage
                                // and now to send to all connected peers and they do the same until it is found
                                [search_id, origin_port, image_names, images, original_data, sender_id, mess_type, images_types, version, timestamp] = readSearchPacket(data);
                                stored_origin = origin_port;
                                let [found, found_images] = searchForImages(images);
                                // images were not found or not all were found
                                if (found == 1 || found_images.length > 0) {

                                        // all images are now found and time to write response
                                        // create response and connect and send to originating image server which will send it to client
                                        let response_packet = rPackets.getResponsePacket(version, "1", "1", found_images.length, singleton.getSequenceNumber(), singleton.getTimestamp(), found_images);
                                        tempConnection(origin_port, response_packet);

                                } else {
                                        // send search packet (data) to peers
                                        let search_id = parseInt(data.slice(16, 24).toString(), 2);
                                        seen_packets.includes(search_id) ? socket.destroy() : seen_packets.push(search_id);
                                        peer_connections.forEach(peer => {
                                                peer.write(data);
                                        });

                                }
                                socket.destroy();
                        } else {
                                // peer communications

                                // if port table is full
                                if (port_table.length >= port_table_max_length) {
                                        console.log(`\nPeer table full: 127.0.0.1:${socket.address().port} redirected`)
                                        //mess_type, num_of_peers, id_length, peer_id, host_address, port_address
                                        message_packet = mPackets.getPacket("2", port_table.length, peer_id.length, peer_id, port_table);
                                        socket.write(message_packet);
                                } else {
                                        // when port table has room
                                        // if a port from another peer
                                        message_packet = mPackets.getPacket("1", port_table.length, peer_id.length, peer_id, port_table)
                                        socket.write(message_packet);
                                        console.log(`\nConnected from peer 127.0.0.1:${data}`);
                                        port_pushed ? true : port_table.push(data), connections.push(socket);
                                        port_pushed = true;
                                        socket.pipe(socket);

                                }

                        }
                });
                socket.on("close", () => {
                        peer_connections.splice(peer_connections.indexOf(socket), 1);
                })
                socket.on('error', function (err) {
                        socket.destroy();
                });


        });
}

let image_server;
function formImageDBServer(port) {

        // creates ImageDB server and listens on given port
        image_server = net.Server();
        image_server.listen(port, "127.0.0.1");

        let timestamp;
        console.log(`\nImageDB server is started at timestamp ${singleton.getTimestamp()} and is listening on 127.0.0.1:${port}`);
        let connections = [];
        // when a connection is made to ImageDB
        image_server.on("connection", function (socket) {

                // first connection will always be the getImage client
                if (connections.length < 1) {
                        connections.push(socket);
                }
                const chunks = [];
                // receives image request from getImage
                // receives response from peer server to send to getImage
                socket.on('data', function (data) {

                        if (getPacketType(data) == "request" && chunks.length < 1) {
                                original_request = data;
                                timestamp = displayClientConnection(data);
                                let temp_connection = net.Socket();
                                temp_connection.connect(self_peer_port, "127.0.0.1", () => {
                                        temp_connection.write(data);
                                });
                        } else if (getPacketType(data) == "response" || chunks.length > 0) {
                                chunks.push(data);
                        }
                });
                socket.on('end', () => {
                        // a response packet
                        let data = "";
                        for (chunk in chunks) {
                                data += chunks[chunk].toString();
                        }
                        if (!found_image_packets.includes(data)) found_image_packets.push(data);
                        allImagesFound(socket);
                });
                socket.on('close', function () {

                        let full_packet = "";
                        found_image_packets.forEach(packet => {
                                full_packet += packet.slice(64);
                        })
                        let final_response = rPackets.getResponsePacket(7, 1, 1, found_image_packets.length, singleton.getSequenceNumber(), singleton.getTimestamp(), false, full_packet);
                        writeToClient(connections[0], final_response);
                        console.log(`\nClient-${timestamp} closed the connection`);

                });

        });

}

function main() {
        singleton.init();
        // if a command to connect to another peer was stated
        if (connection_stated) {
                formNewPeerConnection([connect_to_port], null);
        }
        formImageDBServer(self_image_port);
        formPeerServer(self_peer_port);
}

// HELPER FUNCTIONS
// forms temp connection to send single data over and then closes connection
function tempConnection(port, data) {
        let temp_connection = new net.Socket();
        temp_connection.connect(port, "127.0.0.1");
        temp_connection.write(data);
        temp_connection.end();
}
// checks if response packet is fully fullfilled
function allImagesFound(socket) {
        let image_count = parseInt(original_request.slice(11, 16).toString(), 2);
        found_image_packets.length == image_count && origin_port == image_server.address().port.toString() ? socket.destroy() : false;
}
//checks type of packet
function getPacketType(data) {

        let request = parseInt(data.slice(3, 11).toString(), 2); // is a search packet 
        let response = parseInt(data.slice(3, 4).toString(), 2); // is a resposne packet;

        if (request == 3) return "request";
        if (response == 1) return "response";
}

// reads a search packet
function readSearchPacket(data) {
        original_data = data.toString();
        // recieves a search packet and will first look for images locally then send out searchs to connected peers
        data = data.toString();
        [version, data] = [parseInt(data.slice(0, 3), 2), data.slice(3)]; // always 3
        [mess_type, data] = [parseInt(data.slice(0, 8), 2), data.slice(8)]; // always 8
        [ic, data] = [parseInt(data.slice(0, 5), 2), data.slice(5)]; // always 5
        [search_id, data] = [parseInt(data.slice(0, 8), 2), data.slice(8)]; // always 8
        [sender_id_length, data] = [parseInt(data.slice(0, 8), 2), data.slice(8)]; // always 8
        [sender_id, data] = [parseInt(data.slice(0, sender_id_length * 8), 2), data.slice(sender_id_length * 8)];
        origin_address = binary_h.binaryToString(data.slice(0, 72)); // always 72
        data = data.slice(72);
        [origin_port, data] = [parseInt(data.slice(0, 16), 2), data.slice(16)]; // always 16
        timestamp = sender_id;
        let image_types = [];
        let file_name_sizes = [];
        let image_names = [];
        let images = [];

        let it;

        // console.log(data);
        for (let i = 0; i < ic; i++) {

                it = parseInt(data.slice(0, 4), 2);

                switch (it) {
                        case 1:
                                it = "bmp";
                                break;
                        case 2:
                                it = "jpeg";
                                break;
                        case 3:
                                it = "gif";
                                break;
                        case 4:
                                it = "png";
                                break;
                        case 5:
                                it = "tiff";
                                break;
                        case 15:
                                it = 'raw';
                                break;
                }

                image_types.push(it);
                data = data.slice(4);

                file_name_sizes.push(parseInt(data.slice(0, 12), 2));
                data = data.slice(12);

                image_names.push(binary_h.binaryToString(data.slice(0, file_name_sizes[i])));
                data = data.slice(file_name_sizes[i]);
        }
        image_names.forEach(c => {
                images.push(c + "." + image_types[image_names.indexOf(c)]);
        })
        return [search_id, origin_port, image_names, images, original_data, sender_id, mess_type, image_types, version, timestamp];
}

// performs the logging of the packet reception
function displayClientConnection(data) {
        let [search_id, origin_port, image_names, images, original_data, sender_id, mess_type, image_types, version, timestamp] = readSearchPacket(data);
        data = original_data.toString();
        let packet = "";
        console.log(`\nClient-${sender_id} is connected at timestamp: ${sender_id}`);
        console.log(`\nITP packet recieved:`)

        for (let i = 0; i < data.length; i += 8) {
                if (i % 32 == 0 && i != 0) {
                        packet += "\n"
                }
                packet += " " + data.substring(i, i + 8);
        }
        console.log(packet);

        console.log(`\nClient-${sender_id} requests: `);
        console.log(`\t--ITP Version: ${version}`);
        console.log(`\t--Image Count: ${image_names.length}`);
        console.log(`\t--Request Type: ${mess_type}`);
        console.log(`\t--Image file extension(s): ${image_types}`);
        console.log(`\t--Image file name(s): ${image_names}\n`);

        let f = 1; // 1 for all images found 0 for some images found // need to implement !!!
        let response_type = 1; // 0 means query, 1 means found, 2 means not found, 3 means busy
        let ic = image_names.length;
        let seq_number = singleton.getSequenceNumber();

        return timestamp;
}
// performs the writing of a packet
function writeToClient(socket, response_packet) {
        socket.write(response_packet);
        socket.end();
}

// checks if all requested images were found
// searchs locally for images and returns true or false
function searchForImages(images) {
        let local_files = [];

        fs.readdirSync(`./`).forEach(file => {
                local_files.push(file);
        });
        local_files.splice(local_files.indexOf('peer2peerDB.js'), 1);
        let found_images = [];
        images.forEach(c => {
                if (local_files.includes(c)) {
                        found_images.push(c);
                }
        })
        let every_image = (arr, tar) => tar.every(v => arr.includes(v));
        return [every_image(local_files, images) ? 1 : 0, found_images];

}

// decides which error to throw based on input
function throwError(string) {
        switch (string) {
                case 'command':
                        throw new Error("Unrecognized command.");
                case 'args':
                        throw new Error("Too many arguments.");
                case 'no address':
                        throw new Error("Must assign an address if you use the -p command.");
                case 'port_table':
                        throw new Error("This address does not exist in the port table.");
                case 'folder':
                        throw new Error("This file is not in an appropriate peerX-Y folder.");
        }
}

// Gets peer id from folder name eg. PeerX-Y ... returns X;
function getPeerId(folder_name) {

        // peerX-Y: starts at index X
        let peer_id_start_index = 4;
        let peer_id_end_index;

        // finds X before '-'
        for (let i = peer_id_start_index; i < folder_name.length; i++) {
                if (isNaN(parseInt(folder_name[i]))) {
                        peer_id_end_index = (i);
                        break;
                }
        }
        return folder_name.substring(peer_id_start_index, peer_id_end_index);
}

// Gets table size from folder name eg. PeerX-Y ... returns Y;
function getPeerTableSize(folder_name) {

        // peerX-Y: starts at index X
        let peer_id_start_index = 4;
        let peer_id_end_index;

        // finds Y after '-'
        for (let i = peer_id_start_index; i < folder_name.length; i++) {
                if (isNaN(parseInt(folder_name[i]))) {
                        peer_id_end_index = (i);
                        break;
                }
        }
        return folder_name.substring(peer_id_end_index + 1, folder_name.length);
}

function getNumberOfPeers(data) {
        let number_of_peers = parseInt(data.substring(11, 24), 2);
        return number_of_peers;
}

// parses binary to retrieve and return port table
function getTable(data) {
        // min length of data = 40 bits (all header plus min 8 bits for sender id)
        let number_of_peers = getNumberOfPeers(data);
        let temp_table = [];
        let binary = data;


        for (let i = 0; i < number_of_peers; i++) {
                let last_port = binary.slice(binary.length - 16, binary.length);
                binary = binary.slice(0, binary.length - 16);
                temp_table[i] = parseInt(last_port, 2);
                binary = binary.slice(0, binary.length - 72);
        }

        return temp_table;
}





main();