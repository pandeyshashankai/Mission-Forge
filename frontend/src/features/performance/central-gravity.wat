(module
 (func (export "accel") (param $mu f64) (param $x f64) (param $y f64) (param $z f64) (result f64)
  (local $r f64)
  (local.set $r (f64.sqrt (f64.add (f64.add (f64.mul (local.get $x) (local.get $x)) (f64.mul (local.get $y) (local.get $y))) (f64.mul (local.get $z) (local.get $z)))))
  (f64.div (f64.mul (f64.neg (local.get $mu)) (local.get $x)) (f64.mul (f64.mul (local.get $r) (local.get $r)) (local.get $r)))))
