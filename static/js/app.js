var app = angular.module('paisavasoolApp',[]);

app.controller('AdminVentureCreateCtrl', function($scope, $http) {
	$scope.createVenture = function() {
		console.log($scope.venture);
		$http.post('/venture/create', $scope.venture).success(function(data){
			if(!data.success){
				$scope.status = "Error!";
				$scope.flashmsg = data.message;
			} else {
				$scope.status = "Success!";
				$scope.flashmsg = "";
			}
		});
	}	
});

app.controller('AdminVentureWithdrawCtrl', function($scope, $http) {
	$http.get('/ventures').success(function(data){
		$scope.ventures = data;
	});
	$scope.withdraw = function() {
		console.log({'name' : $scope.venturename.username, 'amount' : $scope.venturewithdrawamount});
		$http.post('/venture/withdraw', {'name' : $scope.venturename.username, 'amount' : $scope.venturewithdrawamount}).success(function(data){
			if(!data.success){
				$scope.status = "Error!";
				$scope.flashmsg = data.message;
			} else {
				$scope.status = "Success!";
				$scope.flashmsg = "";
			}
		});
	}	
});

app.controller('CustomerRechargeCtrl', function($scope, $http) {
	$scope.recharge = function(){
		console.log($scope.cust);
		$http.post('/customer/recharge', $scope.cust).success(function(data){
			if(!data.success){
				$scope.status = "Error!";
				$scope.flashmsg = data.message;
			} else {
				$scope.status = "Success!";
				$scope.flashmsg = "";
			}
		});
	}
});

app.controller('SaleCtrl', function($scope, $http) {
	$scope.doSale = function(){
		console.log($scope.sale);
		$http.post('/venture/sale', $scope.sale).success(function(data){
			if(!data.success){
				$scope.status = "Error!";
				$scope.flashmsg = data.message;
			} else {
				$scope.status = "Success!";
				$scope.flashmsg = "";
			}

		});

	}
});