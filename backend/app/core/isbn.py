import re


def _isbn10_is_valid(isbn: str) -> bool:
    total = sum((10 - index) * (10 if char == "X" else int(char)) for index, char in enumerate(isbn))
    return total % 11 == 0


def _isbn13_is_valid(isbn: str) -> bool:
    total = sum((3 if index % 2 else 1) * int(char) for index, char in enumerate(isbn))
    return total % 10 == 0


def normalize_isbn(value: str) -> str:
    """Removes spaces and hyphens and checks the check digit. Raises ValueError if the ISBN is not valid."""
    isbn = re.sub(r"[\s-]", "", value).upper()
    if re.fullmatch(r"\d{9}[\dX]", isbn) and _isbn10_is_valid(isbn):
        return isbn
    if re.fullmatch(r"\d{13}", isbn) and _isbn13_is_valid(isbn):
        return isbn
    raise ValueError("Enter a valid 10 or 13 digit ISBN")
