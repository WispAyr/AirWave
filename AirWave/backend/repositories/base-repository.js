class BaseRepository {
    constructor(database) {
        if (!database) {
            throw new Error('Database instance is required');
        }
        this.db = database;
    }

    run(sql, params = []) {
        return this.db.prepare(sql).run(params);
    }

    get(sql, params = []) {
        return this.db.prepare(sql).get(params);
    }

    all(sql, params = []) {
        return this.db.prepare(sql).all(params);
    }

    transaction(callback) {
        const txn = this.db.transaction(callback);
        return txn();
    }
}

module.exports = BaseRepository;
