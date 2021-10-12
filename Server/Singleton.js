
let time_stamp;
let refernece_time;
let seq_number;
let timer_interval = 10;

function timerRun() {
        time_stamp++;
        if (time_stamp == 4294967295) {
                time_stamp = Math.floor(1000 * Math.random()); // reset timer to be within 32 bit size
        }
}

module.exports = {

        init: function () {
                time_stamp = Math.floor(Math.random() * 1000);
                setInterval(timerRun, timer_interval);
                seq_number = Math.floor(Math.random() * Math.pow(2, 15));

        },

        getTimestamp: function () {
                return time_stamp;
        },
        getSequenceNumber: function () {
                seq_number++;
                return seq_number;
        },
        getPort: function () {

                return Math.floor(Math.random() * 49151) + 1024;
        }
}