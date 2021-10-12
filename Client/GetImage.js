// IMPORTS
let net = require('net');
let fs = require('fs');
let open = require("open");
let path = require('path');
let sPackets = require('../Server/SearchPacket');
let singleton = require('../Server/Singleton');
let binary_h = require('../BinaryHandler');
// PARSING COMMAND LINE ARGS

// Enter your code for the client functionality here
let input_commands = process.argv.slice(2);

// retrives host and port from command
let server_index = input_commands.findIndex(c => c == "-s");
let host = input_commands[server_index + 1].split(":")[0];
let port = input_commands[server_index + 1].split(":")[1];

// gets picture names
let pictures_index_begin = (input_commands.findIndex(c => c == "-q")) + 1;
let end_index = 2;


let end_flag = true;
for (let i = pictures_index_begin; i < input_commands.length; i++) {
        if (input_commands[i].includes('-')) {
                end_index = i;
                end_flag = false;
                break;
        }
}
if (end_flag) {
        end_index = input_commands.length;
}


let pictures = input_commands.slice(pictures_index_begin, end_index);

// gets picture count


// gets version
let version_index = input_commands.findIndex(c => c == "-v");
let version = input_commands[version_index + 1];

version == "7" ? true : throwError('version');

// GetImage initializes a connection to a peer, it then sends the image data it wants.
// If that image data is not locally stored at the peer, the peer will then send out search requests to its connected peers.

singleton.init();

let image_client = new net.Socket();
image_client.connect(port, host, function () {
        let timestamp = singleton.getTimestamp();
        let search_id = Math.floor(Math.random() * 100);
        let search_packet = sPackets.formSearchPacket(version, '3', pictures.length, search_id, timestamp.toString().length, timestamp, "127.0.0.1", port, pictures);
        console.log(`Connected to ImageDB server on 127.0.0.1:${port}`)
        image_client.write(search_packet);
});



const chunks = [];
image_client.on('data', (chunk) => {
        chunks.push(chunk);
});
image_client.on("pause", () => {
        console.log("pause");
});

image_client.on('end', () => {
        let data = "";
        for (chunk in chunks) {
                data += chunks[chunk].toString();
        }

        let header_chunks = data.slice(0, 64);
        data = data.slice(64);
        let image_count = display_header(header_chunks);
        let images = display_body(data, image_count);

        (async () => {
                // Opens the image in the default image viewer and waits for the opened app to finish.
                for (var i = 0; i < image_count; i++) {
                        await open(`./${images[i]}`, { wait: true });
                }
        })();
        image_client.destroy();

})

image_client.on('close', () => {
        console.log("Disconnecting from server");
        console.log("Connection closed")
});

function display_header(header_chunks) {
        let data = header_chunks;
        let header = '';

        // data is packet recieved from peer that has searched for the image and successfully found it 
        // parses all information of resposne from peer

        let version = parseInt(data.slice(0, 3).toString(), 2);
        let fullfilled = parseInt(data.slice(3, 4), 2);
        let response_type = parseInt(data.slice(4, 12), 2);
        let image_count = parseInt(data.slice(12, 17), 2);
        let seq_num = parseInt(data.slice(17, 32), 2);
        let timestamp = parseInt(data.slice(32, 64), 2);

        switch (fullfilled) {
                case 1:
                        fullfilled = "Yes";
                        break;
                case 2:
                        fullfilled = "No";
                        break;
        }
        switch (response_type) {
                case 0:
                        response_type = "Query";
                        break;
                case 1:
                        response_type = "Found";
                        break;
                case 2:
                        response_type = "Not Found";
                        break;
                case 3:
                        response_type = "Busy";
        }

        console.log(`\nITP packet header recieved: `);

        let display_header = '';
        for (let i = 0; i < header.length; i += 8) {
                if (i % 32 == 0 && i != 0) {
                        display_header += "\n"
                }
                display_header += " " + header.slice(i, i + 8);
        }
        console.log(display_header);

        console.log(`\nServer sent: \n`);
        console.log(`\t--ITP version: ${version}`);
        console.log(`\t--Fullfilled = ${fullfilled}`);
        console.log(`\t--Response Type = ${response_type}`);
        console.log(`\t--Image Count = ${image_count}`);
        console.log(`\t--Sequence Number = ${seq_num}`);
        console.log(`\t--Timestamp = ${timestamp}\n\n`);

        return image_count;
}

function display_body(data, image_count) {

        let image_types = [], file_name_sizes = [], image_bytes_sizes = [], image_file_names = [], image_datas = [];

        let full_image_names = [];

        for (let i = 0; i < image_count; i++) {

                // Image type (jpeg, gif)
                let it = parseInt(data.slice(0, 4), 2);
                image_types[i] = return_it(it);
                data = data.slice(4);

                // file name sizes
                file_name_sizes[i] = parseInt(data.slice(0, 12), 2); // * 8 ?
                data = data.slice(12);

                // Image Byte Size
                image_bytes_sizes[i] = parseInt(data.slice(0, 16), 2);
                data = data.slice(16);

                // Image File Name
                image_file_names[i] = data.slice(0, file_name_sizes[i]).toString();
                data = data.slice(file_name_sizes[i]);

                // Image data
                image_datas[i] = data.slice(0, image_bytes_sizes[i] * 16);
                data = data.slice(image_bytes_sizes[i] * 16);

                let image_ascii = binary_h.binaryToString(image_datas[i]);
                let image_buffer = Buffer.from(image_ascii, 'base64');

                full_image_names.push(`${image_file_names[i]}.${image_types[i]}`);

                fs.writeFileSync(`./${image_file_names[i]}.${image_types[i]}`, image_buffer);
        }
        return full_image_names;
}


function return_it(it) {
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
        return it;
}

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
                case 'version':
                        throw new Error("Wrong ITP Version.");
        }
}