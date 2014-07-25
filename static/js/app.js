var app = angular.module('paisavasoolApp', ['ngProgress']);

app.controller('AdminVentureCreateCtrl', function($scope, $http, ngProgress) {
    $scope.createVenture = function() {
        if ($scope.venture.pwd == $scope.venture.cpwd) {
            ngProgress.start();
            $http.post('/venture/create', $scope.venture).success(function(data) {
                $scope.venture = undefined;
                if (!data.success) {
                    $scope.status = "Error!";
                    $scope.flashmsg = data.message;
                } else {
                    $scope.status = "Success!";
                    $scope.flashmsg = "";
                }
                ngProgress.complete();
            });
        } else {
            $scope.status = "Error!";
            $scope.flashmsg = "Passwords do not match!";
        }
    }
});

app.controller('AdminVentureWithdrawCtrl', function($scope, $http, ngProgress) {
    $http.get('/ventures').success(function(data) {
        $scope.ventures = data;
    });
    $scope.withdraw = function() {
        if ($scope.venturename.balance > 0) {
            ngProgress.start();
            $http.post('/venture/withdraw', {
                'name': $scope.venturename.username,
                'amount': $scope.venturewithdrawamount
            }).success(function(data) {
                if (!data.success) {
                    $scope.status = "Error!";
                    $scope.flashmsg = data.message;
                } else {
                    $scope.status = "Success!";
                    $scope.flashmsg = "";
                }
                ngProgress.complete();
            });
        } else {
            $scope.status = "Error!";
            $scope.flashmsg = "Cannot withdraw from negative balance account!";
        }
    }
});

app.controller('CustomerRechargeCtrl', function($scope, $http, ngProgress) {
    $scope.recharge = function() {
        ngProgress.start();
        $http.post('/customer/recharge', $scope.cust).success(function(data) {
            $scope.cust = undefined;
            if (!data.success) {
                $scope.status = "Error!";
                $scope.flashmsg = data.message;
            } else {
                $scope.status = "Success!";
                $scope.flashmsg = "";
            }
            ngProgress.complete();
        });
    }
});

app.controller('SaleCtrl', function($scope, $http, ngProgress) {
    $scope.doSale = function() {
        ngProgress.start();
        $http.post('/venture/sale', $scope.sale).success(function(data) {
            $scope.sale = undefined;
            if (!data.success) {
                $scope.status = "Error!";
                $scope.flashmsg = data.message;
            } else {
                $scope.status = "Success!";
                $scope.flashmsg = "";
		$scope.sale = undefined;
            }
            ngProgress.complete();
        });

    }
});

app.controller('CustBalCtrl', function($scope, $http, ngProgress) {
    $scope.checkBal = function() {
        ngProgress.start();
        $http.get('/customer/balance?custid='+$scope.cust.custid+'&pin='+$scope.cust.pin).success(function(data) {
            if (!data.success) {
                $scope.status = "Error!";
                $scope.flashmsg = data.message;
            } else {
                $scope.status = "Success!";
                $scope.flashmsg = "";
		$scope.balance = data.balance;
		$scope.cust.pin = undefined;
            }
            ngProgress.complete();
        });

    }
});