import unittest
from route_catalog import route_count, route_page, iter_route_catalog

class RouteCatalogTests(unittest.TestCase):
    def setUp(self):
        self.names = ['Depot', 'A', 'B', 'C']
        self.matrix = [
            [0, 2, 5, 7],
            [2, 0, 3, 4],
            [5, 3, 0, 6],
            [7, 4, 6, 0],
        ]

    def test_factorial_count(self):
        self.assertEqual(route_count(7), 5040)
        self.assertEqual(route_count(0), 1)

    def test_catalog_has_all_unique_orders(self):
        rows = list(iter_route_catalog(self.names, self.matrix))
        self.assertEqual(len(rows), 6)
        self.assertEqual(len({tuple(row['route']) for row in rows}), 6)
        self.assertTrue(all(row['route'][0] == 'Depot' and row['route'][-1] == 'Depot' for row in rows))

    def test_page_bounds_and_distance(self):
        page = route_page(self.names, self.matrix, page=1, page_size=2)
        self.assertEqual(page['total_routes'], 6)
        self.assertEqual(len(page['routes']), 2)
        row = page['routes'][0]
        self.assertEqual(row['distance_km'], sum(x['distance_km'] for x in row['legs']))

    def test_invalid_page_size(self):
        with self.assertRaises(ValueError):
            route_page(self.names, self.matrix, page=0, page_size=0)

if __name__ == '__main__':
    unittest.main()
