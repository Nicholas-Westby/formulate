using Formulate.Core.Utilities.Submissions;
using System.Net.Mail;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.SendEmail.DesignedEmail;
using Formulate.Extensions.SendEmail.Utilities;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// The model a designed email's views get, as Formulate Pro gave it.
/// </summary>
public sealed class EmailDataTests
{
    [Fact]
    public void Values_are_found_by_alias_or_name_in_any_case()
    {
        var first = Field("First name", TextKind, alias: "firstName");
        var colour = Field("Favourite colour?", TextKind);
        var form = Form(first, colour);
        var submission = Submit(form).Value(first, "Ada").Value(colour, "Blue").Build();

        dynamic values = Create(submission).Values;

        Assert.Equal("Ada", (string)values.firstName);
        Assert.Equal("Ada", (string)values.FIRSTNAME);

        // Without an alias the name is used, without spaces and symbols.
        Assert.Equal("Blue", (string)values.Favouritecolour);
    }

    [Fact]
    public void Values_hold_the_first_value_and_collections_hold_them_all()
    {
        var colours = Field("Colours", TextKind, alias: "colours");
        var form = Form(colours);
        var submission = Submit(form).Value(colours, "Red", "Blue").Build();
        var data = Create(submission);

        dynamic values = data.Values;
        dynamic collections = data.CollectionValues;

        Assert.Equal("Red", (string)values.colours);
        Assert.Equal(new object[] { "Red", "Blue" }, (object[])collections.colours);
    }

    [Fact]
    public void Missing_values_are_null_and_missing_collections_are_empty()
    {
        var data = Create(Submit(Form()).Build());

        dynamic values = data.Values;
        dynamic collections = data.CollectionValues;

        // As in Formulate Pro, a view can name a field the form does not have without an error.
        Assert.Null((object?)values.ThisPropertyDoesNotExist);
        Assert.Empty((object[])collections.ThisPropertyDoesNotExist);
    }

    [Fact]
    public void Uploads_are_files_that_show_their_names()
    {
        var photos = Field("Photos", UploadKind, alias: "photos");
        var form = Form(photos);
        var submission = Submit(form)
            .File(photos, "C:\\fakepath\\one.png", new byte[] { 1 }, "image/png")
            .File(photos, "two.png", new byte[] { 2 }, "image/png")
            .Build();
        var data = Create(submission);

        dynamic values = data.Values;
        dynamic collections = data.CollectionValues;
        var first = Assert.IsType<EmailDataFile>((object)values.photos);

        Assert.Equal("one.png", first.FileName);
        Assert.Equal(new byte[] { 1 }, first.FileData);
        Assert.Equal("image/png", first.ContentType);
        Assert.Equal("one.png", first.ToString());
        Assert.Equal(new[] { "one.png", "two.png" }, ((object[])collections.photos).Select(x => x.ToString()));
    }

    [Fact]
    public void Upload_names_have_no_hidden_characters()
    {
        var photo = Field("Photo", UploadKind, alias: "photo");
        var form = Form(photo);
        var submission = Submit(form).File(photo, "me‮gnp.exe", new byte[] { 1 }).Build();
        var data = Create(submission);

        dynamic values = data.Values;

        Assert.Equal("megnp.exe", ((EmailDataFile)values.photo).FileName);
    }

    [Fact]
    public void Files_posted_under_a_field_that_is_not_an_upload_field_are_left_out()
    {
        var name = Field("Name", TextKind, alias: "name");
        var notes = Field("Notes", TextKind, alias: "notes");
        var photo = Field("Photo", UploadKind, alias: "photo");
        var form = Form(name, notes, photo);
        var submission = Submit(form)
            .Value(name, "Ada")
            .File(name, "posted-under-name.exe", new byte[] { 9 })
            .File(notes, "posted-under-notes.exe", new byte[] { 9 })
            .File(photo, "me.png", new byte[] { 2 })
            .Build();
        var data = Create(submission);

        dynamic values = data.Values;
        dynamic collections = data.CollectionValues;
        IReadOnlyDictionary<string, object?> raw = collections.GetRawValues();

        Assert.Equal("Ada", (string)values.name);
        Assert.Equal(new[] { "URL", "PageName", "name", "photo" }, raw.Keys);
        Assert.Equal("me.png", ((EmailDataFile)values.photo).FileName);
    }

    [Fact]
    public void Raw_values_list_the_page_then_the_fields_in_form_order()
    {
        var b = Field("B", TextKind, alias: "b");
        var a = Field("A", TextKind, alias: "a");
        var file = Field("File", UploadKind, alias: "file");
        var form = Form(b, file, a);
        var submission = Submit(form).Value(a, "1").Value(b, "2").File(file, "f.txt", new byte[] { 3 }).OnPage(5).Build();
        var data = Create(submission, new SubmissionPage("https://site.test/", "Home"));

        dynamic collections = data.CollectionValues;
        IReadOnlyDictionary<string, object?> raw = collections.GetRawValues();

        Assert.Equal(new[] { "URL", "PageName", "b", "file", "a" }, raw.Keys);
        Assert.Equal(new object?[] { "https://site.test/" }, (object?[])raw["URL"]!);
        Assert.Equal(new object?[] { "Home" }, (object?[])raw["PageName"]!);
    }

    [Fact]
    public void A_field_whose_definition_is_not_stored_is_left_out_of_the_values()
    {
        var name = Field("Name", TextKind, alias: "name");
        var robot = Field("Robot check", RecaptchaKind, alias: "robot");
        var submission = Submit(Form(name, robot)).Value(name, "Ada").Value(robot, "03AGdBq-TOKEN").Build();

        var expando = (Formulate.Extensions.SendEmail.DesignedEmail.SafeExpandoObject)Create(submission).Values;

        Assert.DoesNotContain("robot", expando.GetRawValues().Keys, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("name", expando.GetRawValues().Keys, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sender_recipients_subject_and_message_come_from_the_handler()
    {
        var configuration = new DesignedEmailConfiguration { Subject = "Subject", Message = "Message" };
        var recipients = EmailRecipients.For("to", new[] { new MailAddress("zed@site.test"), new MailAddress("amy@site.test") });

        var data = EmailDataFactory.Create(Submit(Form()).Build(), FieldDefinitions, SubmissionPage.None, configuration, "forms@site.test", recipients);

        Assert.Equal("forms@site.test", data.SenderEmail);
        Assert.Equal(new[] { "amy@site.test", "zed@site.test" }, data.RecipientEmails);
        Assert.Equal("Subject", data.Subject);
        Assert.Equal("Message", data.Message);
        Assert.NotNull(data.Helper);
    }

    [Fact]
    public void Helper_attaches_each_file_once_and_ignores_other_values()
    {
        var one = new EmailDataFile("one.png", new byte[] { 1 }, "image/png");
        var two = new EmailDataFile("two.png", new byte[] { 2 }, "image/png");
        var empty = new EmailDataFile("empty.txt", Array.Empty<byte>(), "text/plain");
        var helper = new EmailDataHelper();

        helper.AttachFile(one);
        helper.AttachFile(one);
        helper.AttachFile(new object[] { one, two });
        helper.AttachFile(empty);
        helper.AttachFile("not a file");
        helper.AttachFile(null);

        Assert.Equal(new[] { one, two }, helper.Attachments);
    }

    [Fact]
    public void Safe_expando_object_removes_symbols_from_names_and_ignores_case()
    {
        var expando = new SafeExpandoObject(fallbackValue: "fallback");
        expando.SetValue("Page Name?", "Home");
        expando.SetValue(" ", "ignored");
        dynamic values = expando;

        Assert.Equal("Home", (string)values.pagename);
        Assert.Equal("fallback", (string)values.Missing);
        Assert.Equal(new[] { "PageName" }, expando.GetRawValues().Keys);
    }

    private static EmailData Create(FormSubmissionRequest submission, SubmissionPage? page = null)
    {
        return EmailDataFactory.Create(submission, FieldDefinitions, page ?? SubmissionPage.None, new DesignedEmailConfiguration(), "forms@site.test",
            EmailRecipients.For("to", new[] { new MailAddress("team@site.test") }));
    }
}
