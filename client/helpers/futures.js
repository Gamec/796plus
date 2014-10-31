Template.futures.helpers({
    tickChart: function() {
        var transactions = Trades.find({}, {sort: {date: 1}, limit: 100}).fetch();
        var data = [];

        transactions.forEach(function(t) {
            data.push([parseFloat(t.price)]);
        });

        console.log(data);

        return {
            chart: {
                type: 'spline'
            },
            title: {
                text: 'Tick Chart'
            },
            xAxis: {
                //type: 'datetime',
                // dateTimeLabelFormats: { // don't display the dummy year
                //     month: '%e. %b',
                //     year: '%b'
                // },
                // title: {
                //     text: 'Date'
                // }
            },
            yAxis: {
                title: {
                    text: 'Price ($)'
                }
            },
            tooltip: {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat: '${point.y:.2f}'
            },

            series: [{
                name: 'Price ($)',
                data: data
            }]
        };
    },
    settlementCountdown: function() {
        SysSecond = 66503;
        InterValObj = window.setInterval(SetRemainTime, 1000);

        function SetRemainTime() { 
            if (SysSecond > 0) { 
                SysSecond = SysSecond - 1; 
                var second = Math.floor(SysSecond % 60);
                var minute = Math.floor((SysSecond / 60) % 60);
                var hour = Math.floor((SysSecond / 3600) % 24);
                var day = Math.floor((SysSecond / 3600) / 24);
                var html = 'Settlement Countdown: ';
                if (day > 0){
                    html += '<strong>'+day+'</strong>D ';
                }
                if (hour > 0){
                    html += '<strong>'+hour+'</strong>';
                }
                if (minute > 0){
                    html += '<strong>:'+minute+'</strong>';
                }
                if (second > 0){
                    html += '<strong>:'+second+'</strong>';
                }
                else {
                    html += '<strong>:0</strong>';
                }

                $('#settlement-countdown').html(html);
            } 
            else {
                window.clearInterval(InterValObj); 
                $('#settlement-countdown').html('Settlement'); 
            } 
        }
    }
});