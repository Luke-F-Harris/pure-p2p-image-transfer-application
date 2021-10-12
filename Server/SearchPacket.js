let binary_h = require('../BinaryHandler');

module.exports = {
        // forms header and body of search packet then sends packet
        formSearchPacket: function (v, m_type, ic, search_id, sender_id_length, sender_id, peer_address, peer_port, images) {
                let packet = '';
                packet = formSearchHeader(v, m_type, ic, search_id, sender_id_length, sender_id, peer_address, peer_port) + formSearchBody(images);
                return packet;
        },
}

// helper functions
// forms the header of the search packet
function formSearchHeader(d_v, d_message_type, d_ic, d_search_id, d_sender_id_length, d_sender_id, d_origin_peer_address, d_origin_peer_port) {
        let header = '';
        let b_v = binary_h.binary(parseInt(d_v)); // always 7 = 111
        let b_message_type = binary_h.binary(parseInt(d_message_type), true); // 1 or 2 always 8 bits
        let b_ic = binary_h.binary(d_ic, false, 5); // always 5 bits
        let b_search_id = binary_h.binary(parseInt(d_search_id), true); // always 8 bits


        let b_sender_id_length = binary_h.binary(Math.floor(Math.pow(parseInt(d_sender_id), (1 / 8))), false, 8);

        let b_sender_id = binary_h.binary(parseInt(d_sender_id), false, parseInt(b_sender_id_length, 2) * 8);



        let b_origin_peer_address = binary_h.stringToBinary("127.0.0.1"); // 72 bits long

        let b_origin_peer_port = binary_h.binary(parseInt(d_origin_peer_port), false, 16); // 16 bits long

        header = b_v + b_message_type + b_ic + b_search_id + b_sender_id_length + b_sender_id + b_origin_peer_address + b_origin_peer_port;
        return header;
}

// forms the body of the search packet
function formSearchBody(images) {
        let body = '';

        for (let i = 0; i < images.length; i++) {
                let image = images[i];

                let [d_it, d_image_name] = [image.split('.')[1], image.split('.')[0]];
                let b_it;




                switch (d_it.toLowerCase()) {
                        case 'bmp':
                                b_it = binary_h.binary(1, false, 4);
                                break;
                        case 'jpeg':
                                b_it = binary_h.binary(2, false, 4);
                                break;
                        case 'gif':
                                b_it = binary_h.binary(3, false, 4);
                                break;
                        case 'png':
                                b_it = binary_h.binary(4, false, 4);
                                break;
                        case 'tiff':
                                b_it = binary_h.binary(5, false, 4);
                                break;
                        case 'raw':
                                b_it = binary_h.binary(15, false, 4);
                                break;
                }


                let [b_image_name_size, b_image_name] = [binary_h.binary(d_image_name.length * 8, false, 12), binary_h.stringToBinary(d_image_name)];

                body += b_it + b_image_name_size + b_image_name;
        }
        return body;
}