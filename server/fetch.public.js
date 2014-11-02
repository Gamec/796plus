var REFRESH_INTERVAL = 1000;

Meteor.setInterval(function () { 
    // Ticker
    Meteor.http.call('GET', 'http://api.796.com/v3/futures/ticker.html?type=weekly', {}, function(error, result) {
        if (error) return;
        var data = JSON.parse(result.content);
        var ticker = TickerData.findOne({});
        if (! ticker) 
            TickerData.insert(data.ticker);
        else {
            data.ticker.date = (new Date()).format('H:i:s');
            TickerData.update(ticker._id, {$set: data.ticker});
        }
    });

    // Trades
    Meteor.http.call('GET', 'http://api.796.com/v3/futures/trades.html?type=weekly', {}, function(error, result) {
        if (error) return;
        var data = JSON.parse(result.content);

        var lastTrade = Trades.findOne({}, {sort: {tid: -1}});

        data.forEach(function(item) {
            if (item.tid > lastTrade.tid) Trades.insert(item);
        });
    });

    // Orderbook
    Meteor.http.call('GET', 'http://api.796.com/v3/futures/depth.html?type=weekly', {}, function(error, result) {
        function insertOrder(type, price, amount) {
            var check = Orderbook.findOne({type: type, price: price});
            if (! check) 
                Orderbook.insert({type:type, price: price, amount: amount, updated: (new Date()).getTime()});
            else 
                Orderbook.update(check._id, {$set: {amount: amount, updated: (new Date()).getTime()}});
        }

        if (error) return;

        var data = JSON.parse(result.content);

        // Limit arrays, we're only using 30 asks and 30
        data.bids = data.bids.slice(0, 30);
        data.asks = data.asks.reverse().slice(0, 30);

        data.bids.forEach(function(item) {
            insertOrder('bid', item[0], item[1]);
        });
        data.asks.forEach(function(item) {
            insertOrder('ask', item[0], item[1]);
        });
        Orderbook.remove({updated: { $lt: (new Date()).getTime() - REFRESH_INTERVAL }});
    });
}, REFRESH_INTERVAL);
