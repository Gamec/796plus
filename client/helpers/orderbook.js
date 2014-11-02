Template.orderbook.helpers({
    orders: function () {
        var bids = Orderbook.find({type: 'bid'}, {sort: {price: -1}});
        var asks = Orderbook.find({type: 'ask'}, {sort: {price: 1}});
        return {asks: asks, bids: bids};
    }
});

Template.orderbook.events({
    'click .order-price': function(e) {
        e.preventDefault();
        
        $('#price').val($(e.target).html());
    }
});