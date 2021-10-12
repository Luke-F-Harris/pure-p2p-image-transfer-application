let binary_h = require('../BinaryHandler');
let path = require('path');
let fs = require('fs');
module.exports = {

        // returns response packet 
        getResponsePacket: function (v, f, r_type, ic, seq_num, timestamp, images, final_packetization) {
                let header = formResponseHeader(v, f, r_type, ic, seq_num, timestamp);
                let body;
                if (images != false) {
                        body = formResponseBody(images);
                } else {
                        body = final_packetization;
                } return header + body;

        },
}

// forms the header of the response packet
function formResponseHeader(d_v, d_f, d_r_type, d_ic, d_seq_num, d_timestamp) {

        let b_v, b_f, b_r_type, b_ic, b_seq_num, b_timestamp;

        [b_v, b_f, b_r_type, b_ic, b_seq_num, b_timestamp] = [binary_h.binary(d_v, false, 3), binary_h.binary(d_f, false, 1), binary_h.binary(d_r_type, true), binary_h.binary(d_ic, false, 5), binary_h.binary(d_seq_num, false, 15), binary_h.binary(d_timestamp, false, 32)];
        return b_v + b_f + b_r_type + b_ic + b_seq_num + b_timestamp;
}

// forms body of response packet
function formResponseBody(d_images) {
        let body = "";
        for (let i = 0; i < d_images.length; i++) {
                let b_it;

                let d_it = d_images[i].split('.')[1];
                let d_image_name = d_images[i].split('.')[0];

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
                };

                body += b_it;

                let b_file_name_size = binary_h.binary(d_image_name.length, false, 12);
                body += b_file_name_size;

                let ascii_image_data = fs.readFileSync(d_images[i], 'base64');
                let b_image_data = binary_h.stringToBinary(ascii_image_data);

                let b_image_data_size_bytes = binary_h.binary(b_image_data.length / 16, false, 16);
                body += b_image_data_size_bytes;

                let b_file_name = d_image_name;
                body += b_file_name;
                body += b_image_data;


        }

        return body;
}
