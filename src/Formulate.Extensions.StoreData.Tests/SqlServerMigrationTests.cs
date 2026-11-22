using Formulate.Extensions.StoreData.Migrations;
using Formulate.Extensions.StoreData.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using System.Reflection;
using System.Reflection.Emit;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Infrastructure.Install;
using Umbraco.Cms.Persistence.SqlServer;
using Umbraco.Extensions;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

/// <summary>
/// Runs the Store Data migration plan against a real SQL Server. Everything else tests with SQLite.
/// </summary>
/// <remarks>
/// Set FORMULATE_TEST_SQLSERVER to a connection string for a server the test may create databases on
/// (for example "Server=localhost,1433;User Id=sa;Password=...;TrustServerCertificate=True"), and the
/// test boots Umbraco on a new, empty database there, lets it run the plan, and checks the table.
/// Without the variable the test is skipped. CI sets it, with a SQL Server service container.
/// </remarks>
public sealed class SqlServerMigrationTests
{
    public const string ConnectionStringVariable = "FORMULATE_TEST_SQLSERVER";

    private const string PlanName = "Formulate.Extensions.StoreData";

    public static bool HasSqlServer => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionStringVariable));

    [Fact(SkipUnless = nameof(HasSqlServer), SkipType = typeof(SqlServerMigrationTests), Skip = "Set " + ConnectionStringVariable + " to a SQL Server connection string to run this.")]
    public async Task The_plan_creates_the_submissions_table_and_index_on_SQL_Server()
    {
        var server = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable(ConnectionStringVariable));
        var databaseName = "formulate_migration_" + Guid.NewGuid().ToString("N");
        var contentRoot = Path.Combine(Path.GetTempPath(), "formulate-sqlserver-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(contentRoot);

        await using (var master = new SqlConnection(server.ConnectionString))
        {
            await master.OpenAsync(TestContext.Current.CancellationToken);
            await using var create = master.CreateCommand();
            create.CommandText = $"CREATE DATABASE [{databaseName}]";
            await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        var database = new SqlConnectionStringBuilder(server.ConnectionString) { InitialCatalog = databaseName };

        try
        {
            await BootUmbracoAsync(contentRoot, database.ConnectionString);

            await using var connection = new SqlConnection(database.ConnectionString);
            await connection.OpenAsync(TestContext.Current.CancellationToken);

            var columns = await QueryAsync(
                connection,
                "SELECT COLUMN_NAME + ' ' + DATA_TYPE + ' ' + ISNULL(CAST(CHARACTER_MAXIMUM_LENGTH AS varchar(10)), '') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'FormulateSubmissions'");
            Assert.Equal(7, columns.Count);
            Assert.Contains("SubmissionId uniqueidentifier ", columns);
            Assert.Contains("FormId uniqueidentifier ", columns);
            Assert.Contains("PageId int ", columns);
            Assert.Contains("DataValues nvarchar -1", columns);
            Assert.Contains("FileValues nvarchar -1", columns);
            Assert.Contains($"Url nvarchar {FormulateSubmissionDto.UrlMaxLength}", columns);
            Assert.Contains(columns, x => x.StartsWith("CreationDate datetime", StringComparison.Ordinal));

            var indexColumns = await QueryAsync(
                connection,
                "SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id " +
                $"WHERE i.name = '{AddSubmissionUrlAndFormIndex.IndexName}' AND i.is_unique = 0 ORDER BY ic.key_ordinal");
            Assert.Equal(AddSubmissionUrlAndFormIndex.IndexColumns, indexColumns);

            var state = await QueryAsync(
                connection,
                "SELECT [value] FROM umbracoKeyValue WHERE [key] = 'Umbraco.Core.Upgrader.State+Formulate.Extensions.StoreData'");
            Assert.Equal(new[] { new FormulateStoreDataMigrationPlan().FinalState }, state);
        }
        finally
        {
            SqlConnection.ClearAllPools();
            await using var master = new SqlConnection(server.ConnectionString);
            await master.OpenAsync(TestContext.Current.CancellationToken);
            await using var drop = master.CreateCommand();
            drop.CommandText = $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]";
            await drop.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);

            if (Directory.Exists(contentRoot))
            {
                Directory.Delete(contentRoot, true);
            }
        }
    }

    private static async Task BootUmbracoAsync(string contentRoot, string connectionString)
    {
        // Umbraco loads every library the test host lists, and one of them (xunit.abstractions) is not on disk.
        AppDomain.CurrentDomain.AssemblyResolve += EmptyAssemblyFor;

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = contentRoot });
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:umbracoDbDSN"] = connectionString,
            ["ConnectionStrings:umbracoDbDSN_ProviderName"] = "Microsoft.Data.SqlClient",
            ["Umbraco:CMS:Unattended:InstallUnattended"] = "true",
            ["Umbraco:CMS:Unattended:UnattendedUserName"] = "Migration Test",
            ["Umbraco:CMS:Unattended:UnattendedUserEmail"] = "migration@example.com",
            ["Umbraco:CMS:Unattended:UnattendedUserPassword"] = "Migration-Test-1234!",
            ["Umbraco:CMS:Global:Id"] = Guid.NewGuid().ToString(),
        });

        // The data protection and web components are what a bare Umbraco boot needs from the host. The back
        // office and the website are left out: the plan does not need them.
        builder.Services.AddDataProtection();
        builder.CreateUmbracoBuilder().AddCore().AddWebComponents().AddUmbracoSqlServerSupport().Build();

        await using var app = builder.Build();

        try
        {
            // Installs the Umbraco database (unattended).
            await app.BootUmbracoAsync();

            // Runs the plan the way Umbraco's package migration runner does after a site starts.
            var runner = app.Services.GetRequiredService<PackageMigrationRunner>();
            await runner.RunPackagePlansAsync(new[] { PlanName });
        }
        finally
        {
            AppDomain.CurrentDomain.AssemblyResolve -= EmptyAssemblyFor;
        }
    }

    private static Assembly? EmptyAssemblyFor(object? sender, ResolveEventArgs args)
    {
        var name = new AssemblyName(args.Name).Name!;

        // Only this one, so any other missing dependency still fails.
        if (name != "xunit.abstractions")
        {
            return null;
        }

        return AssemblyBuilder.DefineDynamicAssembly(new AssemblyName(name), AssemblyBuilderAccess.Run);
    }

    private static async Task<List<string>> QueryAsync(SqlConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var rows = new List<string>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            rows.Add(Convert.ToString(reader.GetValue(0)) ?? string.Empty);
        }

        return rows;
    }
}
