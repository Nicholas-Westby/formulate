using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class StoreFilesTests : IDisposable
{
    private static readonly Guid UploadKind = Guid.Parse(UploadFieldDefinition.Constants.KindId);

    private readonly string _outer = Path.Combine(Path.GetTempPath(), "formulate-storefiles-" + Guid.NewGuid().ToString("N"));
    private readonly CapturingLogger<StoreFiles> _logger = new();
    private readonly Guid _submissionId = Guid.NewGuid();

    public StoreFilesTests()
    {
        Directory.CreateDirectory(_outer);
    }

    public void Dispose() => Directory.Delete(_outer, true);

    private string Root => Path.Combine(_outer, "content", "App_Data", "Formulate", "Uploads");

    private StoreFiles CreateStore(long maxBytes = StoreDataSettings.DefaultMaxUploadBytes)
    {
        var settings = Options.Create(new StoreDataSettings { MaxUploadBytes = maxBytes });
        var folders = new UploadFolders(Path.Combine(_outer, "content"), settings.Value.UploadsFolderPath);
        return new StoreFiles(folders, settings, _logger);
    }

    private static PersistedFormField Field(Guid kind, string name = "Resume") =>
        new() { Id = Guid.NewGuid(), KindId = kind, Name = name };

    private StoreFilesInput Input(PersistedFormField field, params (string Name, string Content)[] files)
    {
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field } };
        var values = files
            .Select(x => new FormFileValue { Name = x.Name, Data = System.Text.Encoding.UTF8.GetBytes(x.Content), ContentType = "text/plain" })
            .ToArray();
        return new StoreFilesInput(form, _submissionId, new Dictionary<Guid, IFileFormFieldValues> { [field.Id] = new FilesFormFieldValues(values) });
    }

    private string FieldFolder(PersistedFormField field) =>
        Path.Combine(Root, _submissionId.ToString("N"), field.Id.ToString("N"));

    [Theory]
    [InlineData("../../web.config", "web.config")]
    [InlineData("..\\..\\web.config", "web.config")]
    [InlineData("C:\\x.dll", "x.dll")]
    [InlineData("/etc/passwd", "passwd")]
    [InlineData("a/b/c.txt", "c.txt")]
    [InlineData("", "file")]
    [InlineData("..", "file")]
    [InlineData("   ", "file")]
    [InlineData("x.dll. ", "x.dll")]
    [InlineData("con.txt", "_con.txt")]
    [InlineData("we:ird*na?me.txt", "we_ird_na_me.txt")]
    public void Unsafe_file_names_are_sanitized_and_kept_inside_root(string clientName, string expected)
    {
        var field = Field(UploadKind);
        var entries = CreateStore().Execute(Input(field, (clientName, "data")));

        var entry = Assert.Single(entries);
        Assert.Equal(expected, entry.Value);
        Assert.Equal(field.Id, entry.FieldId);
        Assert.Equal(field.Name, entry.FieldName);

        // The only file anywhere under the temp folder is the one in the field's own folder.
        var written = Directory.GetFiles(_outer, "*", SearchOption.AllDirectories);
        Assert.Equal(Path.Combine(FieldFolder(field), expected), Assert.Single(written));
        Assert.Equal("data", File.ReadAllText(written[0]));
    }

    [Fact]
    public void A_name_of_300_characters_is_shortened_and_keeps_its_extension()
    {
        var field = Field(UploadKind);
        var entries = CreateStore().Execute(Input(field, (new string('a', 300) + ".pdf", "data")));

        var name = Assert.Single(entries).Value;
        Assert.True(name.Length <= UploadFileNames.MaxBytes);
        Assert.EndsWith(".pdf", name);
        Assert.Equal(Path.Combine(FieldFolder(field), name), Assert.Single(Directory.GetFiles(_outer, "*", SearchOption.AllDirectories)));
    }

    [Theory]
    [InlineData("ж", 300, ".pdf")]
    [InlineData("日", 300, ".docx")]
    [InlineData("😀", 300, ".png")]
    [InlineData("ж", 300, "")]
    public void Long_non_ascii_names_are_cut_by_bytes_on_a_character_boundary(string character, int count, string extension)
    {
        var field = Field(UploadKind);
        var entries = CreateStore().Execute(Input(field, (string.Concat(Enumerable.Repeat(character, count)) + extension, "data")));

        var name = Assert.Single(entries).Value;
        Assert.True(System.Text.Encoding.UTF8.GetByteCount(name) <= UploadFileNames.MaxBytes);
        Assert.EndsWith(extension, name);
        Assert.NotEqual(string.Empty, name);

        // Round tripping through UTF-8 loses nothing, so no surrogate pair was split.
        Assert.Equal(name, System.Text.Encoding.UTF8.GetString(System.Text.Encoding.UTF8.GetBytes(name)));
        Assert.False(name.EndsWith(' ') || name.EndsWith('.'));
        Assert.True(File.Exists(Path.Combine(FieldFolder(field), name)));
    }

    [Fact]
    public void A_cut_that_leaves_a_trailing_space_is_trimmed_again()
    {
        // 99 two-byte characters, a space, then more: the byte cap falls just after the space.
        var name = new string('ж', 99) + " " + new string('ж', 50);

        var safe = UploadFileNames.Sanitize(name);

        Assert.False(safe.EndsWith(' '));
        Assert.True(System.Text.Encoding.UTF8.GetByteCount(safe) <= UploadFileNames.MaxBytes);
    }

    [Fact]
    public void A_cut_that_leaves_a_bare_device_name_is_prefixed()
    {
        // The cap cuts "CON" + spaces + "x" back to "CON", which would be the device "CON.txt".
        var safe = UploadFileNames.Sanitize("CON" + new string(' ', 193) + "x.txt");

        Assert.Equal("_CON.txt", safe);
    }

    [Theory]
    [InlineData("com0.txt", "_com0.txt")]
    [InlineData("LPT0", "_LPT0")]
    [InlineData("com\u00B9.txt", "_com\u00B9.txt")]
    [InlineData("LPT\u00B3", "_LPT\u00B3")]
    [InlineData("con .txt", "_con .txt")]
    [InlineData("console.txt", "console.txt")]
    public void Reserved_device_names_are_prefixed(string clientName, string expected)
    {
        Assert.Equal(expected, UploadFileNames.Sanitize(clientName));
    }

    [Theory]
    [InlineData("invoice\u202Efdp.exe", "invoice_fdp.exe")]
    [InlineData("a\u200Eb\u200Fc.txt", "a_b_c.txt")]
    [InlineData("tag\U000E0001x.txt", "tag_x.txt")]
    public void Unicode_format_characters_are_replaced(string clientName, string expected)
    {
        Assert.Equal(expected, UploadFileNames.Sanitize(clientName));
    }

    [Fact]
    public void A_file_that_cannot_be_written_is_skipped_and_logged_and_the_others_are_kept()
    {
        var field = Field(UploadKind);
        var other = new PersistedFormField { Id = Guid.NewGuid(), KindId = UploadKind, Name = "Other" };
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field, other } };

        // A file where the first field's folder should be makes creating that folder fail.
        Directory.CreateDirectory(Path.Combine(Root, _submissionId.ToString("N")));
        File.WriteAllText(FieldFolder(field), "in the way");

        var input = new StoreFilesInput(form, _submissionId, new Dictionary<Guid, IFileFormFieldValues>
        {
            [field.Id] = new FilesFormFieldValues(new[] { new FormFileValue { Name = "blocked.txt", Data = new byte[] { 1 } } }),
            [other.Id] = new FilesFormFieldValues(new[] { new FormFileValue { Name = "fine.txt", Data = new byte[] { 2 } } }),
        });

        var entries = CreateStore().Execute(input);

        var entry = Assert.Single(entries);
        Assert.Equal("fine.txt", entry.Value);
        var warning = Assert.Single(_logger.Entries, x => x.Level == LogLevel.Warning);
        Assert.Contains("blocked.txt", warning.Message);
        Assert.NotNull(warning.Exception);
    }

    [Fact]
    public void Duplicate_names_get_suffixes()
    {
        var field = Field(UploadKind);
        var entries = CreateStore().Execute(Input(field, ("a.txt", "one"), ("a.txt", "two"), ("A.TXT", "three"), ("noext", "four"), ("noext", "five")));

        Assert.Equal(new[] { "a.txt", "a (2).txt", "A (3).TXT", "noext", "noext (2)" }, entries.Select(x => x.Value));
        Assert.Equal("one", File.ReadAllText(Path.Combine(FieldFolder(field), "a.txt")));
        Assert.Equal("two", File.ReadAllText(Path.Combine(FieldFolder(field), "a (2).txt")));
        Assert.Equal("three", File.ReadAllText(Path.Combine(FieldFolder(field), "A (3).TXT")));
        Assert.Equal("five", File.ReadAllText(Path.Combine(FieldFolder(field), "noext (2)")));
    }

    [Fact]
    public void Oversized_upload_is_rejected_and_logged()
    {
        var field = Field(UploadKind);
        var entries = CreateStore(maxBytes: 10).Execute(Input(field, ("big.bin", "12345678901"), ("ok.bin", "1234567890")));

        Assert.Equal("ok.bin", Assert.Single(entries).Value);
        Assert.False(File.Exists(Path.Combine(FieldFolder(field), "big.bin")));
        Assert.True(File.Exists(Path.Combine(FieldFolder(field), "ok.bin")));

        var warning = Assert.Single(_logger.Entries, x => x.Level == LogLevel.Warning);
        Assert.Contains("big.bin", warning.Message);
        Assert.Contains("11", warning.Message);
    }

    [Fact]
    public void Files_for_non_upload_fields_are_ignored()
    {
        var field = Field(Guid.NewGuid(), "Comment");
        var entries = CreateStore().Execute(Input(field, ("sneaky.txt", "data")));

        Assert.Empty(entries);
        Assert.False(Directory.Exists(Root));
        Assert.Contains(_logger.Entries, x => x.Level == LogLevel.Warning && x.Message.Contains("Comment"));
    }

    [Fact]
    public void Files_for_unknown_fields_are_ignored()
    {
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = Array.Empty<PersistedFormField>() };
        var input = new StoreFilesInput(form, _submissionId, new Dictionary<Guid, IFileFormFieldValues>
        {
            [Guid.NewGuid()] = new FilesFormFieldValues(new[] { new FormFileValue { Name = "a.txt", Data = new byte[] { 1 } } }),
        });

        Assert.Empty(CreateStore().Execute(input));
        Assert.False(Directory.Exists(Root));
    }
}
