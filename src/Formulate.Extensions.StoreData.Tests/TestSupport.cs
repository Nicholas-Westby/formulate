using System.Text.Json;
using Formulate.Core.Utilities;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Data.Sqlite;
using NPoco;

namespace Formulate.Extensions.StoreData.Tests;

/// <summary>
/// The submissions table in an in-memory SQLite database, so queries run as real SQL.
/// </summary>
internal sealed class SqliteSubmissionDatabase : ISubmissionDatabase, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public SqliteSubmissionDatabase()
    {
        _connection.Open();

        using var command = _connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE FormulateSubmissions (
                SubmissionId TEXT NOT NULL PRIMARY KEY,
                CreationDate TEXT NOT NULL,
                DataValues TEXT NULL,
                FileValues TEXT NULL,
                FormId TEXT NOT NULL,
                PageId INTEGER NULL,
                Url TEXT NULL);
            """;
        command.ExecuteNonQuery();
    }

    public T Run<T>(Func<IDatabase, T> work)
    {
        using var database = new Database(_connection, DatabaseType.SQLite);
        return work(database);
    }

    public void Dispose() => _connection.Dispose();
}

/// <summary>
/// Serializes with System.Text.Json, which is enough to round trip the stored entries.
/// </summary>
internal sealed class TestJsonUtility : IJsonUtility
{
    public T Deserialize<T>(string value) => JsonSerializer.Deserialize<T>(value)!;

    public string Serialize(object value) => JsonSerializer.Serialize(value);
}

internal sealed class FixedPageUrls : IPageUrlResolver
{
    public string? Url { get; set; }

    public string? GetUrl(int? pageId) => pageId is null ? null : Url;
}
