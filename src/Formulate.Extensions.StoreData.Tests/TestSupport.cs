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
                Url NVARCHAR(4000) NULL);
            """;
        command.ExecuteNonQuery();

        command.CommandText = "CREATE INDEX IX_FormulateSubmissions_FormId_CreationDate ON FormulateSubmissions (FormId, CreationDate, SubmissionId)";
        command.ExecuteNonQuery();
    }

    /// <summary>
    /// Adds a row directly, for tests that need rows the Store Data handler would not write.
    /// </summary>
    public void Seed(Models.FormulateSubmissionDto submission) => Run(db => db.Insert(submission));

    public async Task<T> RunAsync<T>(Func<IDatabase, Task<T>> work)
    {
        using var database = new Database(_connection, DatabaseType.SQLite);
        return await work(database);
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

/// <summary>
/// A repository whose behaviour a test scripts. Anything not scripted is not supported.
/// </summary>
internal sealed class FakeSubmissionRepository : ISubmissionRepository
{
    public Func<Models.FormulateSubmissionDto, Task>? OnInsert { get; set; }

    public Func<Models.FormulateSubmissionDto?, IReadOnlyList<Models.FormulateSubmissionDto>>? OnPageAfter { get; set; }

    public Task InsertAsync(Models.FormulateSubmissionDto submission, CancellationToken cancellationToken) =>
        OnInsert?.Invoke(submission) ?? throw new NotSupportedException();

    public IReadOnlyList<Models.FormulateSubmissionDto> PageAfter(Guid formId, Models.FormulateSubmissionDto? after, int take) =>
        OnPageAfter?.Invoke(after) ?? throw new NotSupportedException();

    public (long Total, IReadOnlyList<Models.FormulateSubmissionDto> Items) Page(Guid formId, long skip, long take) => throw new NotSupportedException();

    public Models.FormulateSubmissionDto? Get(Guid submissionId) => throw new NotSupportedException();

    public bool Delete(Guid submissionId) => throw new NotSupportedException();
}
