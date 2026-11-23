using System.Text;
using Formulate.BackOffice.Api.Services;
using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.Api.Models;
using Formulate.Extensions.StoreData.Models;
using Formulate.Extensions.StoreData.Services;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class SubmissionQueryServiceTests : IDisposable
{
    private readonly SqliteSubmissionDatabase _database = new();
    private readonly Mock<IFormEntityRepository> _forms = new();
    private readonly string _root = Path.Combine(Path.GetTempPath(), "formulate-query-" + Guid.NewGuid().ToString("N"));
    private readonly SubmissionRepository _repository;
    private readonly UploadFolders _folders;
    private readonly CapturingLogger<SubmissionQueryService> _logger = new();
    private readonly PersistedFormField _name = new() { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Name" };
    private readonly PersistedFormField _cv = new() { Id = Guid.NewGuid(), KindId = Guid.Parse(UploadFieldDefinition.Constants.KindId), Name = "CV" };
    private readonly PersistedForm _form;

    public SubmissionQueryServiceTests()
    {
        _repository = new SubmissionRepository(_database);
        _folders = new UploadFolders(_root, null);
        _form = new PersistedForm { Id = Guid.NewGuid(), Name = "Contact", Fields = new[] { _name, _cv } };
        _forms.Setup(x => x.Get(_form.Id)).Returns(_form);
    }

    public void Dispose()
    {
        _database.Dispose();
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, true);
        }
    }

    private readonly List<IFormFieldDefinition> _definitions = new();

    private SubmissionQueryService CreateService() =>
        new(_repository, _forms.Object, new TestJsonUtility(), _folders, new FormFieldDefinitionCollection(() => _definitions), _logger);

    /// <summary>A definition of a kind of field, with the flags that decide what Store Data keeps of it.</summary>
    private static IFormFieldDefinition Definition(Guid kindId, bool isStored = true, bool isTransitory = false, bool isHidden = false, bool isServerSideOnly = false)
    {
        var definition = new Mock<IFormFieldDefinition>();
        definition.SetupGet(x => x.KindId).Returns(kindId);
        definition.SetupGet(x => x.IsStored).Returns(isStored);
        definition.SetupGet(x => x.IsTransitory).Returns(isTransitory);
        definition.SetupGet(x => x.IsHidden).Returns(isHidden);
        definition.SetupGet(x => x.IsServerSideOnly).Returns(isServerSideOnly);

        return definition.Object;
    }

    /// <summary>
    /// Stores a submission as the Store Data handler does, including its files on disk.
    /// </summary>
    private async Task<Guid> StoreAsync(string name, DateTime created, params (string Name, string Content)[] files)
    {
        var settings = Options.Create(new StoreDataSettings());
        IStoreData store = new Utilities.StoreData(
            new StoreFields(new Formulate.Core.FormFields.FormFieldDefinitionCollection(() => Array.Empty<Formulate.Core.FormFields.IFormFieldDefinition>())),
            new StoreFiles(_folders, settings, new CapturingLogger<StoreFiles>()),
            new TestJsonUtility(),
            _repository,
            new FixedPageUrls { Url = "https://example.com/contact/" },
            _folders,
            new CapturingLogger<Utilities.StoreData>());

        var fileValues = new Dictionary<Guid, IFileFormFieldValues>();
        if (files.Length > 0)
        {
            fileValues[_cv.Id] = new FilesFormFieldValues(files
                .Select(x => new FormFileValue { Name = x.Name, Data = Encoding.UTF8.GetBytes(x.Content) })
                .ToArray());
        }

        var request = new FormSubmissionRequest(
            _form,
            7,
            new Dictionary<Guid, IStringFormFieldValues> { [_name.Id] = new StringFormFieldValues(name) },
            fileValues);

        await store.ExecuteAsync(request, TestContext.Current.CancellationToken);

        // Dates are set by the database in production; the test sets them to get a known order.
        _database.Run(db => db.Execute("UPDATE FormulateSubmissions SET CreationDate = @0 WHERE SubmissionId = @1", created, request.Id));

        return request.Id;
    }

    [Fact]
    public async Task Query_pages_newest_first()
    {
        var other = Guid.NewGuid();
        var oldest = await StoreAsync("oldest", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var newest = await StoreAsync("newest", new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc));
        var middle = await StoreAsync("middle", new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc));
        _database.Seed(new FormulateSubmissionDto { SubmissionId = Guid.NewGuid(), FormId = other, CreationDate = DateTime.UtcNow });
        var service = CreateService();

        var first = service.List(_form.Id, 0, 2);
        var second = service.List(_form.Id, 2, 2);

        Assert.Equal(ServiceStatus.Success, first.Status);
        Assert.Equal(3, first.Value!.Total);
        Assert.Equal(new[] { newest, middle }, first.Value.Items.Select(x => x.Id));
        Assert.Equal(new[] { oldest }, second.Value!.Items.Select(x => x.Id));

        var item = first.Value.Items.First();
        Assert.Equal(_form.Id, item.FormId);
        Assert.Equal(7, item.PageId);
        Assert.Equal("https://example.com/contact/", item.Url);
        Assert.Equal(DateTimeKind.Utc, item.CreationDate.Kind);
        var value = Assert.Single(item.Values);
        Assert.Equal((_name.Id, "Name", "newest"), (value.FieldId, value.FieldName, value.Value));
    }

    [Fact]
    public async Task Equal_dates_keep_a_stable_order_across_pages()
    {
        var date = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var ids = new List<Guid>();
        for (var i = 0; i < 5; i++)
        {
            ids.Add(await StoreAsync("n" + i, date));
        }

        var service = CreateService();
        var paged = Enumerable.Range(0, 5).Select(i => service.List(_form.Id, i, 1).Value!.Items.Single().Id).ToArray();

        Assert.Equal(ids.OrderBy(x => x.ToString().ToUpperInvariant(), StringComparer.Ordinal), paged);
    }

    [Theory]
    [InlineData(-1, 10, "skip")]
    [InlineData(0, 0, "take")]
    [InlineData(0, 201, "take")]
    public void Bad_paging_is_invalid(int skip, int take, string field)
    {
        var result = CreateService().List(_form.Id, skip, take);

        Assert.Equal(ServiceStatus.Invalid, result.Status);
        Assert.Equal(field, result.Field);
    }

    [Fact]
    public async Task Get_returns_the_submission_with_its_files_or_not_found()
    {
        var id = await StoreAsync("Ann", DateTime.UtcNow, ("cv.pdf", "pdf"));
        var service = CreateService();

        var found = service.Get(id);

        Assert.Equal(ServiceStatus.Success, found.Status);
        var file = Assert.Single(found.Value!.Files);
        Assert.Equal((_cv.Id, "CV", "cv.pdf"), (file.FieldId, file.FieldName, file.FileName));
        Assert.Equal(ServiceStatus.NotFound, service.Get(Guid.NewGuid()).Status);
    }

    [Fact]
    public async Task Delete_removes_row_and_files()
    {
        var id = await StoreAsync("Ann", DateTime.UtcNow, ("cv.pdf", "pdf"), ("cv.pdf", "again"));
        var keep = await StoreAsync("Bob", DateTime.UtcNow, ("keep.pdf", "keep"));
        Assert.True(Directory.Exists(_folders.SubmissionFolder(id)));
        var service = CreateService();

        var result = service.Delete(id);

        Assert.Equal(ServiceStatus.Success, result.Status);
        Assert.Null(_repository.Get(id));
        Assert.False(Directory.Exists(_folders.SubmissionFolder(id)));
        Assert.NotNull(_repository.Get(keep));
        Assert.True(Directory.Exists(_folders.SubmissionFolder(keep)));
        Assert.Equal(ServiceStatus.NotFound, service.Delete(id).Status);
    }

    [Fact]
    public async Task A_stored_file_is_found_by_its_stored_name()
    {
        var id = await StoreAsync("Ann", DateTime.UtcNow, ("cv.pdf", "one"), ("cv.pdf", "two"));
        var service = CreateService();

        var first = service.GetFile(id, _cv.Id, "cv.pdf");
        var second = service.GetFile(id, _cv.Id, "cv (2).pdf");

        Assert.Equal("one", File.ReadAllText(first.Value!.Path));
        Assert.Equal("two", File.ReadAllText(second.Value!.Path));
        Assert.Equal("cv (2).pdf", second.Value.FileName);
    }

    [Theory]
    [InlineData("../../x")]
    [InlineData("..\\..\\x")]
    [InlineData("../cv.pdf")]
    [InlineData("/etc/passwd")]
    [InlineData("nope.pdf")]
    [InlineData("CV.PDF")]
    public async Task A_file_name_that_was_not_stored_is_not_found_and_builds_no_path(string fileName)
    {
        var id = await StoreAsync("Ann", DateTime.UtcNow, ("cv.pdf", "one"));
        // A file the name could reach if the value were used as a path.
        File.WriteAllText(Path.Combine(_root, "x"), "secret");

        var result = CreateService().GetFile(id, _cv.Id, fileName);

        Assert.Equal(ServiceStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task A_file_from_another_field_or_submission_is_not_found()
    {
        var id = await StoreAsync("Ann", DateTime.UtcNow, ("cv.pdf", "one"));
        var other = await StoreAsync("Bob", DateTime.UtcNow);
        var service = CreateService();

        Assert.Equal(ServiceStatus.NotFound, service.GetFile(id, _name.Id, "cv.pdf").Status);
        Assert.Equal(ServiceStatus.NotFound, service.GetFile(other, _cv.Id, "cv.pdf").Status);
        Assert.Equal(ServiceStatus.NotFound, service.GetFile(Guid.NewGuid(), _cv.Id, "cv.pdf").Status);
        Assert.Equal(ServiceStatus.Invalid, service.GetFile(id, _cv.Id, "").Status);
    }

    [Fact]
    public void A_stored_name_that_escapes_its_folder_is_not_served()
    {
        // A tampered row: the stored name points outside the field's folder.
        var id = Guid.NewGuid();
        File.WriteAllText(Path.Combine(Directory.CreateDirectory(_root).FullName, "secret.txt"), "secret");
        _database.Seed(new FormulateSubmissionDto
        {
            SubmissionId = id,
            FormId = _form.Id,
            FileValues = "[{\"FieldId\":\"" + _cv.Id + "\",\"FieldName\":\"CV\",\"Value\":\"../../../secret.txt\"}]",
        });

        var result = CreateService().GetFile(id, _cv.Id, "../../../secret.txt");

        Assert.Equal(ServiceStatus.NotFound, result.Status);
    }

    private static string[] ReadCsv(Stream stream)
    {
        using (stream)
        {
            var bytes = ((MemoryStream)CopyTo(stream)).ToArray();
            Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, bytes[..3]);
            return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3).Split("\r\n");
        }
    }

    private static Stream CopyTo(Stream stream)
    {
        var copy = new MemoryStream();
        stream.CopyTo(copy);
        return copy;
    }

    [Fact]
    public async Task Export_writes_a_bom_a_header_and_a_row_per_submission_newest_first()
    {
        await StoreAsync("=evil, \"quoted\"", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        await StoreAsync("Zoë", new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc), ("cv.pdf", "x"));

        var result = CreateService().Export(_form.Id);

        Assert.Equal(ServiceStatus.Success, result.Status);
        var lines = ReadCsv(result.Value!);
        Assert.Equal("Submission Id,Created,Page Id,URL,Name,CV", lines[0]);
        Assert.EndsWith(",2026-02-01T00:00:00Z,7,https://example.com/contact/,Zoë,cv.pdf", lines[1][36..]);
        Assert.EndsWith(",2026-01-01T00:00:00Z,7,https://example.com/contact/,\"'=evil, \"\"quoted\"\"\",", lines[2][36..]);
        Assert.Equal(string.Empty, lines[3]);
        Assert.Equal(4, lines.Length);
    }

    [Fact]
    public async Task Export_neutralizes_a_formula_after_a_semicolon()
    {
        await StoreAsync("x;=cmd|' /C calc'!A0", DateTime.UtcNow);

        var lines = ReadCsv(CreateService().Export(_form.Id).Value!);

        Assert.EndsWith(",x;'=cmd|' /C calc'!A0,", lines[1]);
    }

    [Fact]
    public void Export_includes_every_submission_across_batches_with_equal_dates()
    {
        var date = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 1203; i++)
        {
            _database.Seed(new FormulateSubmissionDto { SubmissionId = Guid.NewGuid(), FormId = _form.Id, CreationDate = i < 600 ? date : date.AddSeconds(i), DataValues = "[]", FileValues = "[]" });
        }

        var lines = ReadCsv(CreateService().Export(_form.Id).Value!);

        // Header, 1203 rows and the empty text after the last line break, each row exactly once.
        Assert.Equal(1203 + 2, lines.Length);
        Assert.Equal(1203, lines[1..^1].Select(x => x[..36]).Distinct().Count());
    }

    [Fact]
    public void Export_of_a_deleted_form_uses_the_stored_field_names_or_the_field_id()
    {
        var formId = Guid.NewGuid();
        var named = Guid.NewGuid();
        var unnamed = Guid.NewGuid();
        _database.Seed(new FormulateSubmissionDto
        {
            SubmissionId = Guid.NewGuid(),
            FormId = formId,
            CreationDate = DateTime.UtcNow,
            DataValues = $"[{{\"FieldId\":\"{named}\",\"FieldName\":\"Email\",\"Value\":\"a@example.com\"}},{{\"FieldId\":\"{unnamed}\",\"FieldName\":\"\",\"Value\":\"v\"}}]",
            FileValues = "[]",
        });

        var result = CreateService().Export(formId);

        Assert.Equal(ServiceStatus.Success, result.Status);
        var lines = ReadCsv(result.Value!);
        Assert.Equal($"Submission Id,Created,Page Id,URL,Email,{unnamed}", lines[0]);
        Assert.EndsWith(",a@example.com,v", lines[1]);
    }

    [Fact]
    public void Export_adds_columns_for_stored_values_whose_field_left_the_form_and_suffixes_repeated_names()
    {
        var removed = Guid.NewGuid();
        var sameNameAsForm = Guid.NewGuid();
        _database.Seed(new FormulateSubmissionDto
        {
            SubmissionId = Guid.NewGuid(),
            FormId = _form.Id,
            CreationDate = DateTime.UtcNow,
            DataValues = $"[{{\"FieldId\":\"{_name.Id}\",\"FieldName\":\"Name\",\"Value\":\"Ann\"}},{{\"FieldId\":\"{removed}\",\"FieldName\":\"Old\",\"Value\":\"gone\"}},{{\"FieldId\":\"{sameNameAsForm}\",\"FieldName\":\"Name\",\"Value\":\"dup\"}}]",
            FileValues = "[]",
        });

        var lines = ReadCsv(CreateService().Export(_form.Id).Value!);

        Assert.Equal("Submission Id,Created,Page Id,URL,Name,CV,Old,Name (2)", lines[0]);
        Assert.EndsWith(",Ann,,gone,dup", lines[1]);
    }

    [Fact]
    public void Export_leaves_out_fields_that_store_no_value_and_keeps_hidden_and_server_side_only_fields()
    {
        // A Button, a Header or a Text Constant is transitory, and reCAPTCHA is not stored: each would be a column that is always empty.
        // A kind with no definition (not installed) and the fields that Store Data does keep stay.
        PersistedFormField Field(string name, bool isStored = true, bool isTransitory = false, bool isHidden = false, bool isServerSideOnly = false)
        {
            var kindId = Guid.NewGuid();
            _definitions.Add(Definition(kindId, isStored, isTransitory, isHidden, isServerSideOnly));

            return new PersistedFormField { Id = Guid.NewGuid(), KindId = kindId, Name = name };
        }

        var form = new PersistedForm
        {
            Id = Guid.NewGuid(),
            Name = "Mixed",
            Fields = new[]
            {
                Field("Email"),
                Field("Send", isTransitory: true),
                Field("Robot", isStored: false),
                Field("Heading", isStored: false, isTransitory: true),
                Field("Source", isHidden: true),
                Field("Campaign", isServerSideOnly: true),
                new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Gone kind" },
            },
        };
        _forms.Setup(x => x.Get(form.Id)).Returns(form);

        var lines = ReadCsv(CreateService().Export(form.Id).Value!);

        Assert.Equal("Submission Id,Created,Page Id,URL,Email,Source,Campaign,Gone kind", lines[0]);
    }

    [Fact]
    public void Export_of_an_unknown_form_with_no_submissions_is_not_found()
    {
        Assert.Equal(ServiceStatus.NotFound, CreateService().Export(Guid.NewGuid()).Status);
    }

    [Fact]
    public void Export_stops_with_a_warning_when_a_batch_makes_no_progress()
    {
        // A database that hands back the key it was given (say a date with less precision) would repeat a batch for ever.
        var rows = Enumerable.Range(0, 500)
            .Select(i => new FormulateSubmissionDto { SubmissionId = Guid.NewGuid(), FormId = _form.Id, CreationDate = DateTime.UtcNow, DataValues = "[]", FileValues = "[]" })
            .ToArray();
        var repository = new FakeSubmissionRepository { OnPageAfter = _ => rows };
        var service = new SubmissionQueryService(repository, _forms.Object, new TestJsonUtility(), _folders, new FormFieldDefinitionCollection(() => _definitions), _logger);

        var lines = ReadCsv(service.Export(_form.Id).Value!);

        Assert.Equal(500 + 2, lines.Length);
        Assert.Contains(_logger.Entries, x => x.Level == Microsoft.Extensions.Logging.LogLevel.Warning && x.Message.Contains("did not move past"));
    }

    [Fact]
    public async Task Export_neutralizes_a_formula_after_a_line_break()
    {
        await StoreAsync("a\n=cmd|' /C calc'!A0;", DateTime.UtcNow);

        var lines = ReadCsv(CreateService().Export(_form.Id).Value!);

        Assert.Contains("\"a\n'=cmd|' /C calc'!A0;\"", string.Join("\r\n", lines));
    }

    [Fact]
    public void The_export_temp_file_is_readable_only_by_its_owner_on_unix()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        _database.Seed(new FormulateSubmissionDto { SubmissionId = Guid.NewGuid(), FormId = _form.Id, CreationDate = DateTime.UtcNow, DataValues = "[]", FileValues = "[]" });

        using var stream = Assert.IsType<FileStream>(CreateService().Export(_form.Id).Value);

        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, File.GetUnixFileMode(stream.Name));
    }
}
