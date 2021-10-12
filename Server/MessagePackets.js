
module.exports = {

        // returns message packet 
        getPacket: function (mess_type, num_of_peers, id_length, peer_id, port_table) {
                let header = formHeader(mess_type, num_of_peers, id_length, peer_id);
                let body = '';

                // if number of peers is greater than 0
                if (parseInt(header.substring(11, 24), 2) > 0) {
                        body = formBody(port_table);
                }
                return header + body;
        }
}


// forms the header of the message packet
function formHeader(d_mes_type, d_num_of_peers, d_id_length, d_peer_id) {
        let b_v = binary(7, false, 3); // binary 7;
        let b_message_type = binary(parseInt(d_mes_type), true); // 1 means welcome, 2 mean re-direct
        let b_number_of_peers = binary(d_num_of_peers, false, 13); // number of peers in port table
        let b_peer_id_length = binary(d_id_length, true); // length of peer id
        let b_peer_id = binary(parseInt(d_peer_id), false, d_id_length * 8); // peer id

        let header = b_v + b_message_type + b_number_of_peers + b_peer_id_length + b_peer_id;
        return header;
}

function formBody(port_table) {
        let body = '';
        for (let i = 0; i < port_table.length; i++) {
                body += stringToBinary("127.0.0.1"); // 72 bits long
                body += binary(parseInt(port_table[i]), false, 16);
        }
        return body;
}

// converts number to binary
function binary(n, full, size, duboct) {
        let bi = "";
        let leading = ""
        if (n < 0) {
                n = n >>> 0;
        }
        while (Math.ceil(n / 2) > 0) {
                bi = n % 2 + bi;
                n = Math.floor(n / 2);
        }
        if (bi.length < 8 && full == true) {
                add = 8 - bi.length
                let x = 0;
                while (x < add) {
                        leading += "0"
                        x += 1
                }
        }

        if (!full && size > 0) {
                add = size - bi.length;
                let x = 0;
                while (x < add) {
                        leading += "0";
                        x += 1;
                }
        }
        if (duboct) {
                if (bi.length < 15) {
                        add = 15 - bi.length
                        let x = 0;
                        while (x < add) {
                                leading += "0"
                                x += 1
                        }
                }
        }
        return leading + bi;
}

function stringToBinary(input) {
        var characters = input.split('');

        return characters.map(function (char) {
                const binary = char.charCodeAt(0).toString(2)
                const pad = Math.max(8 - binary.length, 0);
                // Just to make sure it is 8 bits long.
                return '0'.repeat(pad) + binary;
        }).join('');
}

function binaryToString(input) {
        let bytesLeft = input;
        let result = '';

        // Check if we have some bytes left
        while (bytesLeft.length) {
                // Get the first digits
                const byte = bytesLeft.substr(0, 8);
                bytesLeft = bytesLeft.substr(8);

                result += String.fromCharCode(parseInt(byte, 2));
        }

        return result;
}
