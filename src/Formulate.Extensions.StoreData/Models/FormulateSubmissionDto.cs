namespace Formulate.Extensions.StoreData.Models
{
    using NPoco;
    using System;
    using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

    [TableName(TableName)]
    [PrimaryKey(nameof(SubmissionId), AutoIncrement = false)]
    internal sealed class FormulateSubmissionDto
    {
        public const string TableName = "FormulateSubmissions";

        public const int UrlMaxLength = 4000;

        [Column(Name = nameof(SubmissionId))]
        public Guid? SubmissionId { get; set; }

        [Column(Name = nameof(CreationDate))]
        public DateTime CreationDate { get; set; } = DateTime.UtcNow;

        [Column(Name = nameof(DataValues))]
        [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
        public string? DataValues { get; set; }

        [Column(Name = nameof(FileValues))]
        [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
        public string? FileValues { get; set; }

        [Column(Name = nameof(FormId))]
        public Guid FormId { get; set; }

        [Column(Name = nameof(PageId))]
        public int? PageId { get; set; }

        [Column(Name = nameof(Url))]
        public string? Url { get; set; }
    }
}
