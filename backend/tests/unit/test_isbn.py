import pytest

from app.core.isbn import normalize_isbn


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("9780735211292", "9780735211292"),
        ("978-0-7352-1129-2", "9780735211292"),
        (" 978 0735211292 ", "9780735211292"),
        ("0735211299", "0735211299"),
        ("0-8044-2957-x", "080442957X"),
    ],
)
def test_valid_isbns_are_normalized(value: str, expected: str) -> None:
    assert normalize_isbn(value) == expected


@pytest.mark.parametrize(
    "value",
    ["", "abc", "123", "9780735211293", "0735211298", "97807352112921", "X735211299", "978073521129X"],
)
def test_invalid_isbns_are_rejected(value: str) -> None:
    with pytest.raises(ValueError):
        normalize_isbn(value)
