using Formulate.Extensions.StoreData.Api.Models;
using Formulate.Extensions.StoreData.Services;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class CsvExporterTests
{
    [Theory]
    [InlineData("plain", "plain")]
    [InlineData("", "")]
    [InlineData("a,b", "\"a,b\"")]
    [InlineData("say \"hi\"", "\"say \"\"hi\"\"\"")]
    [InlineData("line1\nline2", "\"line1\nline2\"")]
    [InlineData("line1\r\nline2", "\"line1\r\nline2\"")]
    [InlineData("=1+1", "'=1+1")]
    [InlineData("+1", "'+1")]
    [InlineData("-1", "'-1")]
    [InlineData("@SUM(A1)", "'@SUM(A1)")]
    [InlineData("\t=1", "'\t=1")]
    [InlineData("=HYPERLINK(\"http://x\",\"y\")", "\"'=HYPERLINK(\"\"http://x\"\",\"\"y\"\")\"")]
    [InlineData("a=b", "a=b")]
    [InlineData("x;=1+1", "x;'=1+1")]
    [InlineData("a;+b;-c;@d", "a;'+b;'-c;'@d")]
    [InlineData("x;=cmd|' /C calc'!A0", "x;'=cmd|' /C calc'!A0")]
    [InlineData("x;\t=1", "x;'\t=1")]
    [InlineData("=a;=b", "'=a;'=b")]
    [InlineData("1;2", "1;2")]
    [InlineData("a\n=1+1", "\"a\n'=1+1\"")]
    [InlineData("a\r\n+1", "\"a\r\n'+1\"")]
    [InlineData("x;\"=1+1", "\"x;\"\"'=1+1\"")]
    [InlineData("\"=1+1", "\"\"\"'=1+1\"")]
    [InlineData("a\n\"@x", "\"a\n\"\"'@x\"")]
    [InlineData("a\n=cmd|' /C calc'!A0;", "\"a\n'=cmd|' /C calc'!A0;\"")]
    [InlineData("1+1=2", "1+1=2")]
    [InlineData("a\nb=c", "\"a\nb=c\"")]
    [InlineData("a,b;=1", "\"a,b;'=1\"")]
    [InlineData("naïve – 日本語", "naïve – 日本語")]
    public void Csv_quotes_and_neutralizes_formulas(string value, string expected)
    {
        Assert.Equal(expected, CsvExporter.Cell(value));
    }

    [Fact]
    public void Rows_have_the_fixed_columns_then_one_per_field_in_form_order()
    {
        var name = Guid.NewGuid();
        var email = Guid.NewGuid();
        var cv = Guid.NewGuid();
        var columns = new[]
        {
            new CsvExporter.Column(name, "Name"),
            new CsvExporter.Column(email, "E-mail, work"),
            new CsvExporter.Column(cv, "CV"),
        };
        var submission = new SubmissionResponseModel
        {
            Id = Guid.Parse("11111111-2222-3333-4444-555555555555"),
            FormId = Guid.NewGuid(),
            CreationDate = new DateTime(2026, 5, 6, 7, 8, 9, DateTimeKind.Unspecified),
            PageId = 42,
            Url = "https://example.com/a,b",
            Values = new[]
            {
                new SubmissionValueModel { FieldId = email, FieldName = "E-mail", Value = "a@example.com" },
                new SubmissionValueModel { FieldId = name, FieldName = "Name", Value = "=cmd|' /C calc'!A0" },
            },
            Files = new[] { new SubmissionFileModel { FieldId = cv, FieldName = "CV", FileName = "cv (2).pdf" } },
        };

        var writer = new StringWriter();
        CsvExporter.WriteHeader(writer, columns);
        CsvExporter.WriteRow(writer, columns, submission);

        Assert.Equal(
            "Submission Id,Created,Page Id,URL,Name,\"E-mail, work\",CV\r\n"
            + "11111111-2222-3333-4444-555555555555,2026-05-06T07:08:09Z,42,\"https://example.com/a,b\",'=cmd|' /C calc'!A0,a@example.com,cv (2).pdf\r\n",
            writer.ToString());
    }

    [Fact]
    public void The_byte_order_mark_is_the_utf8_one()
    {
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, CsvExporter.ByteOrderMark);
    }
}
