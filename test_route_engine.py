"""Quick regression tests: python3 -m unittest python/test_route_engine.py"""
import unittest
try:
    from .route_engine import demo_scenario, brute_force, held_karp, kruskal_mst_route, divide_and_conquer, validate
except ImportError:
    from route_engine import demo_scenario, brute_force, held_karp, kruskal_mst_route, divide_and_conquer, validate

class RouteEngineTests(unittest.TestCase):
    def test_exact_algorithms_agree(self):
        s = demo_scenario()
        self.assertAlmostEqual(brute_force(s).distance_km, held_karp(s).distance_km)

    def test_heuristics_return_closed_tours(self):
        s = demo_scenario()
        for fn in (kruskal_mst_route, divide_and_conquer):
            result = fn(s)
            self.assertEqual(result.route[0], s.depot)
            self.assertEqual(result.route[-1], s.depot)
            self.assertEqual(len(result.route), len(s.locations) + 2)

    def test_capacity_is_enforced(self):
        s = demo_scenario(); s.capacity = 1
        with self.assertRaises(ValueError): validate(s)

    def test_asymmetric_matrix_is_rejected(self):
        s = demo_scenario(); s.distance_matrix[0][1] += 1
        with self.assertRaises(ValueError): validate(s)

if __name__ == '__main__': unittest.main()
