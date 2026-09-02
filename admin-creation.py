import getpass
import os
import sqlite3


def main():
    database = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.sqlite")
    username = input("Enter account username you want: ").strip()
    invite_code = getpass.getpass("enter account invite code for that account: ").strip()

    if not 3 <= len(username) <= 20:
        raise SystemExit("Username must be between 3 and 20 characters.")
    if not invite_code:
        raise SystemExit("Invite code cannot be empty.")

    connection = sqlite3.connect(database)
    try:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS admin_users ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "username TEXT UNIQUE NOT NULL, "
            "invite_code TEXT NOT NULL, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        )
        connection.execute("DELETE FROM admin_users")
        connection.execute("DELETE FROM admin_accounts")
        connection.execute(
            "INSERT INTO admin_users (username, invite_code) VALUES (?, ?)",
            (username, invite_code),
        )
        connection.commit()
    except sqlite3.IntegrityError as error:
        connection.rollback()
        raise SystemExit(f"Unable to create account: {error}") from error
    finally:
        connection.close()

    print(f"Admin account '{username}' was created and validated.")


if __name__ == "__main__":
    main()
