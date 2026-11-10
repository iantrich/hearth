from custom_components.hearth_crm.enums import ConnectionType, InteractionType


def test_inverse_pairs_swap():
    assert ConnectionType.PARENT.inverse is ConnectionType.CHILD
    assert ConnectionType.PARENT_IN_LAW.inverse is ConnectionType.CHILD_IN_LAW
    assert ConnectionType.EMPLOYEE.inverse is ConnectionType.EMPLOYER


def test_symmetric_types_are_their_own_inverse():
    for t in (ConnectionType.SPOUSE, ConnectionType.SIBLING_IN_LAW, ConnectionType.OTHER):
        assert t.inverse is t and t.symmetric


def test_every_value_has_an_inverse_that_round_trips():
    assert all(t.inverse.inverse is t for t in ConnectionType)
    assert len(ConnectionType) == 25


def test_parse_exact_strings():
    assert ConnectionType.parse("Sibling-in-law") is ConnectionType.SIBLING_IN_LAW
    assert ConnectionType.parse("Cousin") is None and ConnectionType.parse(None) is None
    assert InteractionType.parse("Catch-up") is InteractionType.CATCH_UP
