// create the module and name it hostApp
var hostApp = angular.module('hostApp', ['ngRoute']);

hostApp.service('socket', function ($rootScope){
	var socket = io.connect();
	return{
		on: function (eventName, callback) {
			socket.on(eventName, function() {
				var args = arguments;
				$rootScope.$apply(function () {
					callback.apply(socket, args);
				});
			});
		},
		emit: function (eventName, data, callback) {
			socket.emit(eventName, data, function () {
				var args = arguments;
				$rootScope.$apply(function () {
					if (callback) {
						callback.apply(socket, args);
					}
				});
			})
		}
	};
});

hostApp.config(function($routeProvider) {
	$routeProvider

	//route for home page
	.when('/', {
		templateUrl: 'app/home/home.html',
		controller: 'mainController'
	})

	//route for video page
	.when('/video', {
		templateUrl: 'app/video/video.html',
		controller: 'mainController'
	})
	
	//route for settings page
	.when('/settings', {
		templateUrl: 'app/settings/settings.html',
		controller: 'mainController'
	})
})
// create the controller and inject Angular's $scope
hostApp.controller('mainController', function($scope, socket) {
	$scope.tempLimit = '80';
	$scope.phoneNumber = '15555555555';
	socket.on('tempData', function(data) {
		$scope.currentTemp = data.temp;
		$scope.averageTemp = data.avgTemp;
	
	});
	setInterval(function() {
		socket.emit('home');
	}, 500);
	$scope.setLimit=function(){
		socket.emit('setLimit', {limit: $scope.tempLimit, phone: $scope.phoneNumber});
	};

});
