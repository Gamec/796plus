Router.configure({
	layoutTemplate: 'layout',
	loadingTemplate: 'loading',
});

Router.map(function() {
	this.route('futures', {path: '/'});

	//this.route('transactions', {path: '/transactions'});
});

Router.route('/transactions', function() {
  this.render('transactions');
}, {
  waitOn: function () {
    return Meteor.subscribe('transactions');
  }
});