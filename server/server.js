var REFRESH_INTERVAL = 2500;

Meteor.publish('tickerdata', function() {
    return TickerData.find(); 
});

Meteor.publish('trades', function() {
    return Trades.find({}, {sort: {date: -1}, limit: 30});
});

Meteor.publish('bids', function() {
    return Orderbook.find({type: 'bid'}, {sort: {price: -1}, limit: 30});
});

Meteor.publish('asks', function() {
    return Orderbook.find({type: 'ask'}, {sort: {price:  1}, limit: 30});
});

Meteor.publish('orders', function() {
    return Orders.find();
});

Meteor.publish('positions', function() {
    return Positions.find();
});

Meteor.publish('balances', function() {
    return Balances.find();
});

Meteor.setInterval(function () { 
    // Ticker
    Meteor.http.call('GET', 'http://api.796.com/v3/futures/ticker.html?type=weekly', {}, function(error, result) {
        if (error) return;
        var data = JSON.parse(result.content);
        var ticker = TickerData.findOne({});
        if (! ticker) 
            TickerData.insert(data.ticker);
        else {
            data.ticker.date = (new Date()).formattedTime();
            TickerData.update(ticker._id, {$set: data.ticker});
        }
    });

    // Trades
    Meteor.http.call('GET', 'http://api.796.com/v3/futures/trades.html?type=weekly', {}, function(error, result) {
        if (error) return;
        var data = JSON.parse(result.content);
        data.forEach(function(item) {
            var check = Trades.findOne({tid: item.tid});
            if (!check) Trades.insert(item);
        });
    });

    // Orderbook
    Meteor.http.call('GET', 'http://api.796.com/v3/futures/depth.html?type=weekly', {}, function(error, result) {
        function insertOrder(type, price, amount) {
            var check = Orderbook.findOne({type: type, price: price, amount: amount});
            if (! check) 
                Orderbook.insert({type:type, price: price, amount: amount, updated: (new Date()).getTime()});
            else 
                Orderbook.update(check._id, {$set: {updated: (new Date()).getTime()}});
        }

        if (error) return;

        var data = JSON.parse(result.content);
        data.bids.forEach(function(item) {
            insertOrder('bid', item[0], item[1]);
        });
        data.asks.forEach(function(item) {
            insertOrder('ask', item[0], item[1]);
        });
        Orderbook.remove({updated: { $lt: (new Date()).getTime() - 1000 }});
    });

    if (ServerSession.get('accessToken') != null) {
        // Orders
        Meteor.http.call('GET', 'https://796.com/v1/weeklyfutures/orders?access_token=' + encodeURIComponent(ServerSession.get('accessToken')), {}, function(error, result) {
            if (error) return;
            var body = JSON.parse(result.content);
            // if (body.errno != 0)
            //     throw new Meteor.Error(body.errno, body.msg);

            body.data.forEach(function(item) {
                var check = Orders.findOne({id: item.no});
                if (! check)
                    Orders.insert({id: item.no, type: item.kp, direction: item.bs, price: item.price, qty: item.gnum, completed: item.cjnum, margin: item.bzj, status: item.state, updated: (new Date()).getTime() });
                else
                    Orders.update(check._id, {$set: {id: item.no, type: item.kp, direction: item.bs, price: item.price, qty: item.gnum, completed: item.cjnum, margin: item.bzj, status: item.state, updated: (new Date()).getTime() }});
            });

            Orders.remove({updated: { $lt: (new Date()).getTime() - 1000 }});
        });

        // Positions
        Meteor.http.call('GET', 'https://796.com/v1/weeklyfutures/position?access_token=' + encodeURIComponent(ServerSession.get('accessToken')), {}, function(error, result) {
            if (error) return;
            var body = JSON.parse(result.content);

            function insertPosition(item) {
                var check = Positions.findOne({bs: item.bs, times: item.times});
                item.updated = (new Date()).getTime();
                if (! check)
                    Positions.insert(item);
                else
                    Positions.update(check._id, {$set: item});
            }

            for (key in body.data.buy) {
                insertPosition(body.data.buy[key]);
            }
            for (key in body.data.sell) {
                insertPosition(body.data.sell[key]);
            }

            Positions.remove({updated: { $lt: (new Date()).getTime() - 1000 }});
        });

        // Balances
        Meteor.http.call('GET', 'https://796.com/v1/user/get_balance?access_token=' + encodeURIComponent(ServerSession.get('accessToken')), {}, function(error, result) {
            if (error) return;
            var body = JSON.parse(result.content);

            if (body.errno == 0)
            {
                var balances = Balances.findOne({});
                if (! balances)
                    Balances.insert(body.data);
                else 
                    Balances.update(balances._id, {$set: body.data});
            }
        });
    }
}, REFRESH_INTERVAL);

Meteor.methods({
    authorize: function(appId, apiKey, secretKey) {
        var timestamp = Math.round(+new Date() / 1000);
        var paramUri = 'apikey=' + apiKey + '&appid=' + appId + '&secretkey=' + encodeURIComponent(secretKey) + '&timestamp=' + timestamp;
        var signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(CryptoJS.HmacSHA1(paramUri, secretKey)));

        this.unblock();

        var response = Meteor.http.call('GET', 'https://796.com/oauth/token?appid=' + appId + '&timestamp=' + timestamp + '&apikey=' + apiKey + '&sig=' + signature, {});
        var body = JSON.parse(response.content);

        if (body.errno != 0)
            throw new Meteor.Error(body.errno, body.msg);

        ServerSession.set('accessToken', unescape(body.data.access_token));

        return body.data;
    },
    logout: function() {
        ServerSession.set('accessToken', null);
        // Send call to 796 (delete token)
        return true;
    },
    cancelOrder: function(id, direction) {
        this.unblock();
        var response = Meteor.http.call('POST', 'https://796.com/v1/weeklyfutures/cancel_order', {params: {bs: direction, no: id, access_token: ServerSession.get('accessToken')}});
        var body = JSON.parse(response.content);

        if (body.errno != 0) 
            throw new Meteor.Error(body.errno, body.msg);

        Orders.remove({id: id});
    },
    openPosition: function(direction, price, qty, margin) {
        var params;
        if (direction == 'buy') {
            params = {
                times: margin,
                buy_num: qty,
                buy_price: price,
                access_token: ServerSession.get('accessToken')
            }
        }
        else if (direction == 'sell') {
            params = {
                times: margin,
                sell_num: qty,
                sell_price: price,
                access_token: ServerSession.get('accessToken')
            }
        }
        else {
            throw new Meteor.Error(0, 'Wrong direction.');
        }

        this.unblock();
        var response = Meteor.http.call('POST', 'https://796.com/v1/weeklyfutures/open_' + direction, {params: params});
        var body = JSON.parse(response.content);

        if (body.errno != 0) 
            throw new Meteor.Error(body.errno, body.msg);

        var item = body.data;
        Orders.insert({id: item.no, type: item.kp, direction: item.bs, price: item.price, qty: item.gnum, completed: item.cjnum, margin: item.bzj, status: item.state, updated: (new Date()).getTime() });
    },
    closePosition: function(direction, price, qty, margin) {
        var params = {
            times: margin,
            amount: qty,
            price: price,
            access_token: ServerSession.get('accessToken')
        }

        this.unblock();
        var response = Meteor.http.call('POST', 'https://796.com/v1/weeklyfutures/close_' + direction, {params: params});
        var body = JSON.parse(response.content);

        if (body.errno != 0) 
            throw new Meteor.Error(body.errno, body.msg);

        var item = body.data;
        Orders.insert({id: item.no, type: item.kp, direction: item.bs, price: item.price, qty: item.gnum, completed: item.cjnum, margin: item.bzj, status: item.state, updated: (new Date()).getTime() });
    }
});
