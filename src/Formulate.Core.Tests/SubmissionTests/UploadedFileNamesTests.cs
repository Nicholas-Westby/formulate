namespace Formulate.Core.Tests.SubmissionTests
{
    using Formulate.Core.Submissions.Requests;
    using Xunit;

    public class UploadedFileNamesTests
    {
        [Theory]
        [InlineData(@"C:\fakepath\cv.pdf", "cv.pdf")]
        [InlineData("photos/2026/me.png", "me.png")]
        [InlineData(@"..\../x.dll", "x.dll")]
        [InlineData("plain.txt", "plain.txt")]
        [InlineData(null, "")]
        public void Folder_parts_are_dropped_whichever_separator_is_used(string clientName, string expected)
        {
            Assert.Equal(expected, UploadedFileNames.Clean(clientName, "_"));
        }

        [Theory]
        [InlineData("invoice\u202Efdp.exe", "invoice_fdp.exe")]
        [InlineData("a\u200Eb\u200Fc.txt", "a_b_c.txt")]
        [InlineData("tag\U000E0001x.txt", "tag_x.txt")]
        [InlineData("line\r\nbreak\0.txt", "line__break_.txt")]
        public void Control_and_format_characters_are_replaced(string clientName, string expected)
        {
            Assert.Equal(expected, UploadedFileNames.Clean(clientName, "_"));
        }

        [Fact]
        public void Hidden_characters_can_be_removed_instead()
        {
            Assert.Equal("invoicefdp.exe", UploadedFileNames.Clean("invoice\u202Efdp\t.exe", string.Empty));
        }
    }
}
