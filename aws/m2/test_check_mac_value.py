import importlib.util
from pathlib import Path
import unittest


module_path = Path(__file__).with_name("index.py")
spec = importlib.util.spec_from_file_location("m2_index", module_path)
m2_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m2_index)


class CheckMacValueTests(unittest.TestCase):
    hash_key = "pwFHCqoQZGmho4w6"
    hash_iv = "EkRm7iFT261dpevs"

    def assert_cmv(self, params, expected):
        self.assertEqual(m2_index.check_mac_value(params, self.hash_key, self.hash_iv), expected)

    def test_tilde_vector(self):
        self.assert_cmv({
            "MerchantID": "3002607",
            "ItemName": "Test~Product",
            "TotalAmount": "200",
        }, "CEEAE01D2F9A8E74D4AC0DCE7735B046D73F35A5EC99558A31A2EE03159DA1C9")

    def test_space_uses_plus(self):
        self.assert_cmv({
            "MerchantID": "3002607",
            "ItemName": "My Test Product",
            "TotalAmount": "300",
        }, "7712A5E6EDC3B57086063C88568084C66CE882A21D40E74DE5ACA3B478C6F316")


if __name__ == "__main__":
    unittest.main()