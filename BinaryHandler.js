

module.exports = {
        // converts number to binary
        binary: function (n, full, size, duboct) {
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
                        if (bi.length < 16) {
                                add = 15 - bi.length
                                let x = 0;
                                while (x < add) {
                                        leading += "0"
                                        x += 1
                                }
                        }
                }
                return leading + bi;
        },

        stringToBinary: function (input) {
                var characters = input.split('');

                return characters.map(function (char) {
                        const binary = char.charCodeAt(0).toString(2)
                        const pad = Math.max(8 - binary.length, 0);
                        // Just to make sure it is 8 bits long.
                        return '0'.repeat(pad) + binary;
                }).join('');
        },

        binaryToString: function (input) {
                let bytesLeft = input;
                let result = '';

                // Check if we have some bytes left
                while (bytesLeft.length) {
                        // Get the first digits
                        const byte = bytesLeft.slice(0, 8);
                        bytesLeft = bytesLeft.slice(8);

                        result += String.fromCharCode(parseInt(byte, 2));
                }

                return result;
        },
}