from keystone_sync import guard_problem


def test_guard_allows_normal_and_small_tabs():
    assert guard_problem("WorkOrders", 124, 124) is None
    assert guard_problem("Profiles", 124, 171) is None      # 72%: above the 70% floor
    assert guard_problem("Violations", 3, 6) is None        # small tab, no percentage rule


def test_guard_blocks_empty_and_sharp_drops():
    assert "fetched 0" in guard_problem("Violations", 0, 6)
    assert "below 70%" in guard_problem("WorkOrders", 50, 124)
