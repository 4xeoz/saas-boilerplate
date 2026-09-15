"""Own a new loopback PostgreSQL fixture; never reset, delete, or reuse a cluster.

create --pg-bin /absolute/postgresql/bin
run --fixture /printed/fixture/path -- node ...
stop --fixture /printed/fixture/path
All data and diagnostics are retained. Only synthetic local credentials are persisted, mode 0600.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile

ALIASES = ["DATABASE_URL", "DIRECT_URL", "CLOUD_RECEIVER_RUNTIME_DATABASE_URL",
           "STANDING_MIGRATION_TEST_DATABASE_URL", "STANDING_RACE_TEST_DATABASE_URL",
           "STANDING_CONSENT_CONCURRENCY_TEST_DATABASE_URL"]


def save(path, value):
    with path.open("x") as stream:
        os.chmod(path, 0o600)
        stream.write(value)


def pg_env(root, proof):
    return {"PATH": "/usr/bin:/bin", "PGHOST": "127.0.0.1", "PGPORT": str(proof["port"]),
            "PGUSER": "cr_test", "PGPASSWORD": (root / "password").read_text()}


def sql(root, scope, query):
    return subprocess.check_output([scope["pg_bin"] + "/psql", "-d", scope["database"], "-Atc", query],
                                   env=pg_env(root, scope), text=True).strip()


def identity(root, scope):
    row = json.loads(sql(root, scope, """SELECT row_to_json(t) FROM (SELECT
      current_database() AS database, current_user AS "user", inet_server_port() AS port,
      current_setting('data_directory') AS data_directory,
      (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier) t"""))
    for key in ("database", "user", "port", "data_directory", "system_identifier"):
        if key in scope and row[key] != scope[key]:
            raise RuntimeError("fixture_identity_mismatch")
    return row


def load(root):
    # Refuse path redirection and another user's fixture before reading local test credentials.
    if root != root.resolve() or root.is_symlink() or root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise RuntimeError("fixture_directory_invalid")
    scope = json.loads((root / "scope.json").read_text())
    identity(root, scope)
    return scope


def create(pg_bin):
    pg_bin = str(Path(pg_bin).resolve(strict=True))
    root = Path(tempfile.mkdtemp(prefix="receiver-postgres-", dir=str(Path(tempfile.gettempdir()).resolve())))
    os.chmod(root, 0o700)
    save(root / "password", secrets.token_hex(32))
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    scope = {"pg_bin": pg_bin, "database": "cr_test_" + secrets.token_hex(16),
             "port": port, "user": "cr_test", "data_directory": str(root / "data")}
    commands = [
        ("init", [pg_bin + "/initdb", "-D", scope["data_directory"], "--username=cr_test",
                  "--auth-local=scram-sha-256", "--auth-host=scram-sha-256",
                  "--pwfile=" + str(root / "password"), "--encoding=UTF8", "--locale=C"]),
        ("start", [pg_bin + "/pg_ctl", "-D", scope["data_directory"], "-l", str(root / "postgres.log"),
                   "-o", f"-h 127.0.0.1 -p {port} -k ''", "-w", "start"]),
    ]
    save(root / "scope.json", json.dumps(scope))
    for name, command in commands:
        with (root / (name + ".log")).open("x") as log:
            result = subprocess.run(command, env={"PATH": "/usr/bin:/bin", "LANG": "C"}, stdout=log, stderr=log)
        if result.returncode:
            raise RuntimeError("fixture_" + name + "_failed; retained=" + str(root))
    subprocess.run([pg_bin + "/createdb", scope["database"]], env=pg_env(root, scope), check=True)
    proof = {"version": 1, **identity(root, scope)}
    if sql(root, scope, "SELECT count(*) FROM pg_tables WHERE schemaname='public'") != "0":
        raise RuntimeError("fixture_not_new_empty_database")
    save(root / "proof.json", json.dumps(proof))
    # Add attested cluster identity without overwriting the initial recovery record.
    save(root / "identity.json", json.dumps(proof))
    print(root)


def run(root, command):
    scope = load(root)
    proof = json.loads((root / "proof.json").read_text())
    identity(root, {**scope, **proof})
    url = f"postgresql://cr_test:{(root / 'password').read_text()}@127.0.0.1:{scope['port']}/{scope['database']}"
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env.update({key: url for key in ALIASES})
    env.update(NODE_ENV="test", RECEIVER_TEST_DATABASE_PROOF=str(root / "proof.json"),
               STANDING_UPGRADE_DATABASE_URL=url, JWT_SECRET=secrets.token_hex(32), PORT="0",
               RECEIVER_PUBLIC_URL="http://localhost:4000", FRONTEND_URL="http://localhost:3000",
               COOKIE_DOMAIN="", CLOUD_RECEIVER_PAIRING_SOURCE_HMAC_SECRET=secrets.token_hex(32),
               CLOUD_RECEIVER_GRANT_CONTROL_TOKEN=secrets.token_hex(32),
               CLOUD_RECEIVER_CONNECTOR_TOKEN_SECRET=secrets.token_hex(32),
               CLOUD_RECEIVER_VERIFICATION_ORIGIN="http://localhost:4000", DOTENV_CONFIG_QUIET="true")
    return subprocess.run(command, env=env).returncode


def stop(root):
    scope = load(root)
    proof = json.loads((root / "identity.json").read_text())
    identity(root, {**scope, **proof})
    subprocess.run([scope["pg_bin"] + "/pg_ctl", "-D", scope["data_directory"], "-m", "fast", "-w", "stop"], check=True)
    print("Owned fixture stopped; files retained: " + str(root))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["create", "run", "stop"])
    parser.add_argument("--pg-bin")
    parser.add_argument("--fixture", type=Path)
    args, command = parser.parse_known_args()
    try:
        if args.action == "create":
            if not args.pg_bin: parser.error("create requires --pg-bin")
            create(args.pg_bin)
        else:
            if not args.fixture: parser.error("run/stop require --fixture")
            if args.action == "stop": stop(args.fixture)
            else:
                if command[:1] == ["--"]: command = command[1:]
                if not command: parser.error("run requires -- command")
                raise SystemExit(run(args.fixture, command))
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        # Avoid echoing credentials or subprocess command/environment values.
        print("disposable_fixture_failed: " + type(error).__name__, file=__import__("sys").stderr)
        raise SystemExit(1)
